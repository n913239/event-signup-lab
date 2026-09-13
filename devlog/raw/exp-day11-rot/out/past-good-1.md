逐條檢查 `schema.sql`(9 行,未修改任何檔案):

1. ✅ 金額欄位全是 `INTEGER` 且帶單位:`price_cents`(L4)、`total_cents`(L7)、`unit_price_cents`(L8)。無 `REAL`/`FLOAT`/`NUMERIC`。(`promo_codes.pct` 是百分比不是金額,不計入。)
2. ✅ 時間欄位全部 `INTEGER` epoch,無混用:`created_at`/`expires_at`/`revoked_at`/`opens_at`/`deadline_at`/`early_bird_until`/`valid_until`。(「是不是 UTC」schema 看不出來,epoch 本身無時區,屬契約層。)
3. ✅ `status` 都有 `CHECK`:`events`(L3)= `draft/on_sale/closed/finished/cancelled`,與 spec 活動狀態機一致;spec 的「訂單」狀態機被拆成兩張表 — `seat_holds`(L5)`holding/confirmed/expired/cancelled` + `orders`(L7)`confirmed/checked_in/cancelled`,聯集恰好等於 spec 列舉,無多餘值。
4. ✅ L6 `CREATE UNIQUE INDEX ux_seat_active ON seat_holds(event_id, seat_no) WHERE status IN ('holding','confirmed')`。注意這是 **partial unique index** 而非表級 `UNIQUE(event_id, seat_no)` — 這是對的,表級 UNIQUE 會讓 expired/cancelled 的座位無法再被保留,違反 spec「座位已釋放」。附帶提醒:`order_items.seat_no`(L8)本身沒有唯一性,座位不重複完全依賴 `seat_holds` 那條索引。
5. ✅ L4 `remaining INTEGER NOT NULL CHECK (remaining >= 0)`。
6. ✅ L8 `order_items.unit_price_cents` 為價格快照,L7 `orders.total_cents` 也是快照,不靠 `ticket_type_id` JOIN。
7. ❌ **L9 `promo_codes`** — spec 的 17 條 API 沒有任何優惠碼端點,non-goals L36 也明講「五張表的專案」。早鳥已用 `ticket_types.early_bird_until`(L4)承接,`promo_codes` 是沒有裁判的範圍擴張。其餘 7 張表(members、refresh_tokens、events、ticket_types、seat_holds、orders、order_items)都對得到 spec 功能。
8. ✅ 9 個 `CREATE TABLE` 全部帶 `STRICT`。

**7/8 通過**

檢查項以外順帶一提(不計分):全表沒有任何 `FOREIGN KEY`(`member_id`/`event_id`/`order_id`/`ticket_type_id` 都是裸 INTEGER),以及 `promo_codes.pct` 沒有 `CHECK (pct BETWEEN 0 AND 100)` — 若 L9 那張表要留,至少該補這條。
