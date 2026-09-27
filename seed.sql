-- 開發用種子資料(R11)。可重跑:先清掉這幾筆再插。時間以執行當下為準(unixepoch() × 1000 = epoch 毫秒)。
-- 帳號:staff@example.com / member@example.com,密碼都是 password123(雜湊由 src/lib/password.js 算好貼上)。
DELETE FROM order_items;
DELETE FROM orders;
DELETE FROM seat_holds;
DELETE FROM promo_codes;
DELETE FROM ticket_types;
DELETE FROM events;
DELETE FROM refresh_tokens;
DELETE FROM members;

INSERT INTO members (id, email, password_hash, nickname, role, created_at) VALUES
  ('staff-1',  'staff@example.com',  'pbkdf2$100000$tHxBwgQcmcEdhDgBW0txYA==$vsYbCbcYhqOgZmZNlhL0wYX4DUca7YMSUBuQ/XRX7rI=', '主辦', 'staff',  unixepoch() * 1000),
  ('member-1', 'member@example.com', 'pbkdf2$100000$tHxBwgQcmcEdhDgBW0txYA==$vsYbCbcYhqOgZmZNlhL0wYX4DUca7YMSUBuQ/XRX7rI=', '小明', 'member', unixepoch() * 1000);

INSERT INTO events (id, owner_id, name, opens_at, deadline_at, status, group_min_qty, group_pct, hold_ttl_minutes, created_at) VALUES
  ('ev-1', 'staff-1', '秋季音樂會', (unixepoch() - 86400) * 1000, (unixepoch() + 30 * 86400) * 1000, 'on_sale', 4, 10, 10, unixepoch() * 1000);

INSERT INTO ticket_types (id, event_id, name, price_cents, capacity, remaining, early_bird_until, early_bird_pct) VALUES
  ('tt-general', 'ev-1', '一般', 100000, 60, 60, NULL, 0),
  ('tt-vip',     'ev-1', 'VIP',  200000, 40, 40, (unixepoch() + 7 * 86400) * 1000, 10);

INSERT INTO promo_codes (code, discount_cents, valid_until, event_id) VALUES
  ('WELCOME', 10000, (unixepoch() + 30 * 86400) * 1000, NULL);
