-- 各流程的 SQL 範本（:name 為參數）
-- 所有寫入流程都用 BEGIN IMMEDIATE：一開始就拿寫鎖，避免兩個交易同時讀到「還有位子」。

-- ═══ A. 保留（選位 / 選票種）═══
BEGIN IMMEDIATE;

INSERT INTO reservations (event_id, contact_name, contact_email, expires_at)
SELECT id, :name, :email, unixepoch() + hold_seconds
  FROM events
 WHERE id = :event_id AND status = 'published'
   AND (sale_starts_at IS NULL OR sale_starts_at <= unixepoch())
   AND (sale_ends_at   IS NULL OR sale_ends_at   >  unixepoch())
RETURNING id, expires_at;                     -- 沒回傳列 → 活動未開賣，ROLLBACK

-- A-1 劃位票：每個座位做一次「搶位」，changes() = 0 表示被別人拿走 → ROLLBACK
UPDATE seats
   SET reservation_id = :rid, lock_expires_at = :expires_at
 WHERE id = :seat_id AND event_id = :event_id AND is_blocked = 0
   AND (reservation_id IS NULL OR lock_expires_at <= unixepoch());

INSERT INTO reservation_items (reservation_id, ticket_type_id, seat_id, unit_price)
SELECT :rid, ticket_type_id, id, (SELECT price FROM ticket_types WHERE id = seats.ticket_type_id)
  FROM seats WHERE id = :seat_id;

-- A-2 非劃位票：插 N 列，額滿時 trigger 會 RAISE 'sold out'
INSERT INTO reservation_items (reservation_id, ticket_type_id, unit_price)
SELECT :rid, id, price FROM ticket_types WHERE id = :ticket_type_id;

UPDATE reservations
   SET total_amount = (SELECT coalesce(sum(unit_price), 0) FROM reservation_items WHERE reservation_id = :rid)
 WHERE id = :rid;

COMMIT;

-- ═══ B. 確認 + 出票（付款成功後）═══
BEGIN IMMEDIATE;

UPDATE reservations
   SET status = 'confirmed', confirmed_at = unixepoch(), payment_ref = :payment_ref
 WHERE id = :rid AND status = 'held' AND expires_at > unixepoch();
-- changes() = 0 → 已過期或已處理 → ROLLBACK（若已扣款需走退款）

UPDATE seats SET lock_expires_at = NULL WHERE reservation_id = :rid;   -- 鎖轉為永久（已售）

INSERT INTO tickets (reservation_item_id)
SELECT id FROM reservation_items WHERE reservation_id = :rid;

COMMIT;

-- ═══ C. 使用者取消保留 ═══
BEGIN IMMEDIATE;
UPDATE reservations SET status = 'cancelled' WHERE id = :rid AND status = 'held';
UPDATE seats SET reservation_id = NULL, lock_expires_at = NULL
 WHERE reservation_id = :rid AND lock_expires_at IS NOT NULL;
COMMIT;

-- ═══ D. 定期清理過期保留（可選；不跑也正確，因為判斷都是惰性過期）═══
BEGIN IMMEDIATE;
UPDATE reservations SET status = 'expired'
 WHERE status = 'held' AND expires_at <= unixepoch();
UPDATE seats SET reservation_id = NULL, lock_expires_at = NULL
 WHERE lock_expires_at IS NOT NULL AND lock_expires_at <= unixepoch();
COMMIT;

-- ═══ E. 入場驗票 ═══
UPDATE tickets SET status = 'checked_in', checked_in_at = unixepoch()
 WHERE code = :code AND status = 'valid';     -- changes() = 0 → 無效或已入場
