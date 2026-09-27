-- 活動報名系統 SQLite schema
-- 需求：SQLite >= 3.38（使用 unixepoch()）
-- 時間一律存 INTEGER（Unix epoch 秒），比較簡單、不會有時區字串問題。
-- 金額一律存整數（最小貨幣單位，例如「分」或「元」），避免浮點誤差。

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ─────────────────────────────────────────────
-- 1. 活動
-- ─────────────────────────────────────────────
CREATE TABLE events (
    id              INTEGER PRIMARY KEY,
    title           TEXT    NOT NULL,
    description     TEXT,
    venue_name      TEXT,
    starts_at       INTEGER NOT NULL,
    ends_at         INTEGER,
    sale_starts_at  INTEGER,
    sale_ends_at    INTEGER,
    hold_seconds    INTEGER NOT NULL DEFAULT 600,      -- 保留時間，預設 10 分鐘
    status          TEXT    NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'published', 'closed', 'cancelled')),
    created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
    CHECK (ends_at IS NULL OR ends_at >= starts_at),
    CHECK (hold_seconds > 0)
);

-- ─────────────────────────────────────────────
-- 2. 票種與名額
--    is_seated = 1：劃位票，名額 = 綁定此票種的座位數，quota 留 NULL
--    is_seated = 0：自由入座 / 站票，名額由 quota 控制
-- ─────────────────────────────────────────────
CREATE TABLE ticket_types (
    id              INTEGER PRIMARY KEY,
    event_id        INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name            TEXT    NOT NULL,                  -- 例：全票、學生票、VIP 區
    price           INTEGER NOT NULL CHECK (price >= 0),
    currency        TEXT    NOT NULL DEFAULT 'TWD',
    is_seated       INTEGER NOT NULL DEFAULT 0 CHECK (is_seated IN (0, 1)),
    quota           INTEGER CHECK (quota IS NULL OR quota >= 0),
    max_per_order   INTEGER NOT NULL DEFAULT 4 CHECK (max_per_order > 0),
    sort_order      INTEGER NOT NULL DEFAULT 0,
    UNIQUE (event_id, name),
    CHECK ((is_seated = 1 AND quota IS NULL) OR (is_seated = 0 AND quota IS NOT NULL))
);

-- ─────────────────────────────────────────────
-- 3. 座位（每場活動一份）
--    鎖定狀態直接放在座位上：
--      reservation_id IS NULL                       → 空位
--      reservation_id 有值 且 lock_expires_at > now → 保留中
--      reservation_id 有值 且 lock_expires_at <= now→ 保留已過期，視同空位（惰性過期）
--      reservation_id 有值 且 lock_expires_at IS NULL → 已售出
-- ─────────────────────────────────────────────
CREATE TABLE seats (
    id              INTEGER PRIMARY KEY,
    event_id        INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    ticket_type_id  INTEGER NOT NULL REFERENCES ticket_types(id),   -- 座位所屬區/票種
    section         TEXT    NOT NULL DEFAULT '',
    row_label       TEXT    NOT NULL,
    seat_number     TEXT    NOT NULL,
    is_blocked      INTEGER NOT NULL DEFAULT 0 CHECK (is_blocked IN (0, 1)), -- 公關位、壞位
    reservation_id  INTEGER REFERENCES reservations(id) ON DELETE SET NULL,
    lock_expires_at INTEGER,
    UNIQUE (event_id, section, row_label, seat_number),
    CHECK (reservation_id IS NOT NULL OR lock_expires_at IS NULL)
);
CREATE INDEX idx_seats_ticket_type ON seats(ticket_type_id);
CREATE INDEX idx_seats_reservation ON seats(reservation_id);

-- ─────────────────────────────────────────────
-- 4. 保留單（= 訂單）
--    held → confirmed（出票）
--    held → expired / cancelled
-- ─────────────────────────────────────────────
CREATE TABLE reservations (
    id              INTEGER PRIMARY KEY,
    event_id        INTEGER NOT NULL REFERENCES events(id),
    public_token    TEXT    NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(16)))),
    contact_name    TEXT    NOT NULL,
    contact_email   TEXT    NOT NULL,
    contact_phone   TEXT,
    status          TEXT    NOT NULL DEFAULT 'held'
                    CHECK (status IN ('held', 'confirmed', 'expired', 'cancelled')),
    expires_at      INTEGER NOT NULL,
    total_amount    INTEGER NOT NULL DEFAULT 0,
    payment_ref     TEXT,                              -- 金流交易編號
    created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
    confirmed_at    INTEGER,
    CHECK ((status = 'confirmed') = (confirmed_at IS NOT NULL))
);
CREATE INDEX idx_reservations_status_exp ON reservations(status, expires_at);
CREATE INDEX idx_reservations_email ON reservations(contact_email);

-- 一列 = 一張票（數量 N 就插 N 列），出票時與 tickets 1:1
CREATE TABLE reservation_items (
    id              INTEGER PRIMARY KEY,
    reservation_id  INTEGER NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    ticket_type_id  INTEGER NOT NULL REFERENCES ticket_types(id),
    seat_id         INTEGER REFERENCES seats(id),
    unit_price      INTEGER NOT NULL CHECK (unit_price >= 0),   -- 下單當下的價格快照
    attendee_name   TEXT
);
CREATE INDEX idx_items_reservation ON reservation_items(reservation_id);
CREATE INDEX idx_items_ticket_type ON reservation_items(ticket_type_id);

-- ─────────────────────────────────────────────
-- 5. 票券（確認後才產生）
-- ─────────────────────────────────────────────
CREATE TABLE tickets (
    id                  INTEGER PRIMARY KEY,
    reservation_item_id INTEGER NOT NULL UNIQUE REFERENCES reservation_items(id), -- 防重複出票
    code                TEXT    NOT NULL UNIQUE DEFAULT (upper(hex(randomblob(10)))), -- QR code 內容
    status              TEXT    NOT NULL DEFAULT 'valid'
                        CHECK (status IN ('valid', 'checked_in', 'void')),
    issued_at           INTEGER NOT NULL DEFAULT (unixepoch()),
    checked_in_at       INTEGER,
    CHECK ((status = 'checked_in') = (checked_in_at IS NOT NULL))
);

-- ─────────────────────────────────────────────
-- 6. 一致性 trigger
-- ─────────────────────────────────────────────

-- 劃位票必須帶座位、座位必須屬於此票種且已被這張保留單鎖住；非劃位票不可帶座位
CREATE TRIGGER trg_items_seat_check
BEFORE INSERT ON reservation_items
BEGIN
    SELECT RAISE(ABORT, 'seated ticket type requires seat_id')
     WHERE NEW.seat_id IS NULL
       AND (SELECT is_seated FROM ticket_types WHERE id = NEW.ticket_type_id) = 1;

    SELECT RAISE(ABORT, 'general admission ticket must not have seat_id')
     WHERE NEW.seat_id IS NOT NULL
       AND (SELECT is_seated FROM ticket_types WHERE id = NEW.ticket_type_id) = 0;

    SELECT RAISE(ABORT, 'seat does not belong to ticket type')
     WHERE NEW.seat_id IS NOT NULL
       AND (SELECT ticket_type_id FROM seats WHERE id = NEW.seat_id) IS NOT NEW.ticket_type_id;

    SELECT RAISE(ABORT, 'seat is not locked by this reservation')
     WHERE NEW.seat_id IS NOT NULL
       AND (SELECT reservation_id FROM seats WHERE id = NEW.seat_id) IS NOT NEW.reservation_id;
END;

-- 非劃位票：名額檢查（已確認 + 未過期保留 都算佔用）
CREATE TRIGGER trg_items_quota
BEFORE INSERT ON reservation_items
WHEN NEW.seat_id IS NULL
BEGIN
    SELECT RAISE(ABORT, 'sold out')
     WHERE (SELECT count(*)
              FROM reservation_items ri
              JOIN reservations r ON r.id = ri.reservation_id
             WHERE ri.ticket_type_id = NEW.ticket_type_id
               AND (r.status = 'confirmed'
                    OR (r.status = 'held' AND r.expires_at > unixepoch())))
           >= (SELECT quota FROM ticket_types WHERE id = NEW.ticket_type_id);
END;

-- 每單每票種上限
CREATE TRIGGER trg_items_max_per_order
BEFORE INSERT ON reservation_items
BEGIN
    SELECT RAISE(ABORT, 'exceeds max_per_order')
     WHERE (SELECT count(*) FROM reservation_items
             WHERE reservation_id = NEW.reservation_id
               AND ticket_type_id = NEW.ticket_type_id)
           >= (SELECT max_per_order FROM ticket_types WHERE id = NEW.ticket_type_id);
END;

-- 票種必須屬於同一場活動
CREATE TRIGGER trg_items_same_event
BEFORE INSERT ON reservation_items
BEGIN
    SELECT RAISE(ABORT, 'ticket type belongs to another event')
     WHERE (SELECT event_id FROM ticket_types WHERE id = NEW.ticket_type_id)
        IS NOT (SELECT event_id FROM reservations WHERE id = NEW.reservation_id);
END;

-- ─────────────────────────────────────────────
-- 7. 查詢用 view
-- ─────────────────────────────────────────────

-- 座位即時狀態
CREATE VIEW v_seat_status AS
SELECT s.*,
       CASE
         WHEN s.is_blocked = 1                          THEN 'blocked'
         WHEN s.reservation_id IS NULL                  THEN 'available'
         WHEN s.lock_expires_at IS NULL                 THEN 'sold'
         WHEN s.lock_expires_at > unixepoch()           THEN 'held'
         ELSE 'available'                               -- 保留已過期
       END AS state
  FROM seats s;

-- 票種剩餘名額
CREATE VIEW v_ticket_type_availability AS
SELECT tt.id AS ticket_type_id,
       tt.event_id,
       tt.name,
       tt.price,
       CASE WHEN tt.is_seated = 1
            THEN (SELECT count(*) FROM seats WHERE ticket_type_id = tt.id AND is_blocked = 0)
            ELSE tt.quota END                                                   AS capacity,
       (SELECT count(*) FROM reservation_items ri JOIN reservations r ON r.id = ri.reservation_id
         WHERE ri.ticket_type_id = tt.id AND r.status = 'confirmed')            AS sold,
       (SELECT count(*) FROM reservation_items ri JOIN reservations r ON r.id = ri.reservation_id
         WHERE ri.ticket_type_id = tt.id AND r.status = 'held'
           AND r.expires_at > unixepoch())                                     AS held
  FROM ticket_types tt;
