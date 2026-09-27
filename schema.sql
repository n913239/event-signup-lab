-- 活動報名系統 schema(D1 / SQLite)
-- 2026-09-27:作者起稿,寫作 session 補三處(一人一活動一個 holding、orders.hold_id 唯一、名稱長度)、作者審。
-- 慣例:時間一律 INTEGER epoch 毫秒;金額一律 INTEGER 分,欄名 *_cents;id 為 TEXT;每張表 STRICT。

CREATE TABLE members (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  nickname TEXT NOT NULL
    CHECK (length(nickname) BETWEEN 1 AND 50),
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('member', 'staff')),
  created_at INTEGER NOT NULL,
  -- 登入失敗鎖定(作者 2026-09-27 定):連續失敗次數與鎖到何時;成功登入歸零
  failed_logins INTEGER NOT NULL DEFAULT 0
    CHECK (failed_logins >= 0),
  locked_until INTEGER
) STRICT;

CREATE TABLE refresh_tokens (
  token_hash TEXT PRIMARY KEY NOT NULL,
  member_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  FOREIGN KEY (member_id) REFERENCES members(id)
) STRICT;

CREATE INDEX idx_refresh_tokens_member_id
  ON refresh_tokens(member_id);

CREATE INDEX idx_refresh_tokens_expires_at
  ON refresh_tokens(expires_at);

CREATE TABLE events (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL
    CHECK (length(name) BETWEEN 1 AND 100),
  opens_at INTEGER NOT NULL,
  deadline_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'on_sale'
    CHECK (status IN ('draft', 'on_sale', 'closed', 'finished')),
  group_min_qty INTEGER NOT NULL DEFAULT 4
    CHECK (group_min_qty >= 2),
  group_pct INTEGER NOT NULL DEFAULT 10
    CHECK (group_pct BETWEEN 0 AND 100),
  hold_ttl_minutes INTEGER NOT NULL DEFAULT 10
    CHECK (hold_ttl_minutes BETWEEN 5 AND 30),
  created_at INTEGER NOT NULL,
  CHECK (opens_at < deadline_at),
  FOREIGN KEY (owner_id) REFERENCES members(id)
) STRICT;

CREATE INDEX idx_events_owner_id
  ON events(owner_id);

CREATE INDEX idx_events_status
  ON events(status);

CREATE TABLE ticket_types (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL,
  name TEXT NOT NULL
    CHECK (length(name) BETWEEN 1 AND 100),
  price_cents INTEGER NOT NULL
    CHECK (price_cents >= 0),
  capacity INTEGER NOT NULL
    CHECK (capacity >= 0),
  remaining INTEGER NOT NULL
    CHECK (remaining >= 0),
  early_bird_until INTEGER,
  early_bird_pct INTEGER NOT NULL DEFAULT 0
    CHECK (early_bird_pct BETWEEN 0 AND 100),
  CHECK (remaining <= capacity),
  UNIQUE (event_id, name),
  FOREIGN KEY (event_id) REFERENCES events(id)
) STRICT;

CREATE INDEX idx_ticket_types_event_id
  ON ticket_types(event_id);

CREATE TABLE seat_holds (
  id TEXT PRIMARY KEY NOT NULL,
  hold_id TEXT NOT NULL,
  -- 同一個 hold 內的座位序號(0 起);每個 hold 恰好一列 seq = 0,給 ux_member_holding 用
  seq INTEGER NOT NULL
    CHECK (seq >= 0),
  event_id TEXT NOT NULL,
  seat_no TEXT NOT NULL,
  ticket_type_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('holding', 'confirmed', 'expired', 'cancelled')),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,

  CHECK (
    (
      length(seat_no) = 2
      AND substr(seat_no, 1, 1) GLOB '[A-J]'
      AND substr(seat_no, 2, 1) GLOB '[1-9]'
    )
    OR
    (
      length(seat_no) = 3
      AND substr(seat_no, 1, 1) GLOB '[A-J]'
      AND substr(seat_no, 2, 2) = '10'
    )
  ),

  FOREIGN KEY (event_id) REFERENCES events(id),
  FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id),
  FOREIGN KEY (member_id) REFERENCES members(id)
) STRICT;

CREATE INDEX idx_seat_holds_hold_id
  ON seat_holds(hold_id);

CREATE INDEX idx_seat_holds_event_status
  ON seat_holds(event_id, status);

CREATE INDEX idx_seat_holds_member_event
  ON seat_holds(member_id, event_id);

CREATE INDEX idx_seat_holds_expires_at
  ON seat_holds(expires_at);

CREATE UNIQUE INDEX ux_seat_active
  ON seat_holds(event_id, seat_no)
  WHERE status IN ('holding', 'confirmed');

-- 一人一活動最多一個 holding(通用做法 6):一個 hold 有多個座位列,只拿 seq = 0 那列當代表
CREATE UNIQUE INDEX ux_member_holding
  ON seat_holds(member_id, event_id)
  WHERE status = 'holding' AND seq = 0;

CREATE TABLE orders (
  id TEXT PRIMARY KEY NOT NULL,
  member_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  hold_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL
    CHECK (status IN ('confirmed', 'checked_in', 'cancelled')),
  subtotal_cents INTEGER NOT NULL
    CHECK (subtotal_cents >= 0),
  early_bird_pct INTEGER NOT NULL
    CHECK (early_bird_pct BETWEEN 0 AND 100),
  group_pct INTEGER NOT NULL
    CHECK (group_pct BETWEEN 0 AND 100),
  promo_cents INTEGER NOT NULL DEFAULT 0
    CHECK (promo_cents >= 0),
  total_cents INTEGER NOT NULL
    CHECK (total_cents >= 0),
  promo_code TEXT,
  confirmed_at INTEGER NOT NULL,
  FOREIGN KEY (member_id) REFERENCES members(id),
  FOREIGN KEY (event_id) REFERENCES events(id)
) STRICT;

CREATE INDEX idx_orders_member_id
  ON orders(member_id);

CREATE INDEX idx_orders_event_id
  ON orders(event_id);

CREATE UNIQUE INDEX ux_orders_member_event_promo
  ON orders(member_id, event_id, promo_code)
  WHERE promo_code IS NOT NULL
    AND status IN ('confirmed', 'checked_in');

CREATE TABLE order_items (
  order_id TEXT NOT NULL,
  seat_no TEXT NOT NULL,
  ticket_type_id TEXT NOT NULL,
  unit_price_cents INTEGER NOT NULL
    CHECK (unit_price_cents >= 0),

  PRIMARY KEY (order_id, seat_no),

  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id)
) STRICT;

CREATE INDEX idx_order_items_ticket_type_id
  ON order_items(ticket_type_id);

CREATE TABLE promo_codes (
  code TEXT PRIMARY KEY NOT NULL,
  discount_cents INTEGER NOT NULL
    CHECK (discount_cents > 0),
  valid_until INTEGER NOT NULL,
  event_id TEXT,
  FOREIGN KEY (event_id) REFERENCES events(id)
) STRICT;

CREATE INDEX idx_promo_codes_event_id
  ON promo_codes(event_id);