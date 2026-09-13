**check-schema 結果**(`schema.sql`,9 行,未修改任何檔案)

1. ✅ 金額欄位全部 `INTEGER` 且帶 `_cents`:`price_cents`(L4)、`total_cents`(L7)、`unit_price_cents`(L8)。`promo_codes.pct`(L9)是百分比不是金額,不算。—— 如題所述,這裡只能確認「是整數」,分/元屬契約,schema 看不出來。
2. ✅ 時間欄位全部 `INTEGER` epoch,無混用:`created_at`、`expires_at`、`revoked_at`、`opens_at`、`deadline_at`、`early_bird_until`、`valid_until`。epoch 本身無時區,所以「UTC」成立;但**秒還是毫秒**跟第 1 條的元/分一樣,schema 看不出來。
3. ✅ `events.status`(L3)`CHECK IN ('draft','on_sale','closed','finished','cancelled')` 與 spec 活動狀態機完全一致。訂單狀態機被拆成兩張表:`seat_holds.status`(L5)`holding/confirmed/expired/cancelled` + `orders.status`(L7)`confirmed/checked_in/cancelled`,聯集恰好等於 spec 的五個狀態,與 API「confirm → 建訂單」的流程相符。
4. ❌ **L6**:`ux_seat_active` 是 partial unique index,`WHERE status = 'holding'`。hold 一旦 confirm 變成 `'confirmed'` 就脫離索引範圍,同一 `(event_id, seat_no)` 可以被別人再建一筆 `holding` —— 已售出的座位會被重複賣。`order_items`(L8)只有 `seat_no` 沒有 `event_id`,也補不了這個洞。partial index 的思路是對的(要讓 expired/cancelled 的座位可重用),但述詞至少要是 `status IN ('holding','confirmed')`。
5. ✅ L4 `remaining INTEGER NOT NULL CHECK (remaining >= 0)`。
6. ✅ L8 `order_items.unit_price_cents`,不靠 `ticket_type_id` JOIN 回 `ticket_types.price_cents`。
7. ❌ **L9** `promo_codes`:spec 的 17 條 API 沒有任何一條收折扣碼,狀態機也沒提;早鳥已經由 `ticket_types.early_bird_until`(L4)承接。`non-goals.md` L36 明寫「五張表的專案」,這張表就是清單開頭警告的「順手加的功能」。其餘 7 張表(members、refresh_tokens、events、ticket_types、seat_holds、orders、order_items)都能對到 spec 的 API。
8. ✅ 9 個 `CREATE TABLE` 全部帶 `STRICT`。

**6/8 通過**

檢查清單以外、順帶看到的一點:全部 9 張表都沒宣告任何 `FOREIGN KEY`(`member_id`、`event_id`、`order_id`、`ticket_type_id` 全是裸 INTEGER)。不在這 8 條裡,所以不計分,但你可能想知道。
