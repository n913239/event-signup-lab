**`/check-schema` 結果**(只讀不改)

1. ✅ 金額欄位全是 `INTEGER` 且帶 `_cents`:`price_cents`(L4)、`total_cents`(L7)、`unit_price_cents`(L8)。`pct`(L9)是百分比不是金額。—— 如提示所述,schema 只能證明「是整數」,證明不了「是分不是元」。
2. ✅ 時間欄位型別一致:`created_at` / `expires_at` / `revoked_at` / `opens_at` / `deadline_at` / `early_bird_until` / `valid_until` 全部 `INTEGER` epoch,沒有混 TEXT。—— 同樣的極限:「是 UTC」schema 看不出來,那是寫入端的契約。
3. ✅ `status` 都有 `CHECK`:`events`(L3)`draft/on_sale/closed/finished/cancelled` 與 spec 活動狀態機完全一致;spec 的「訂單」狀態機被拆成 `seat_holds`(L5)`holding/confirmed/expired/cancelled` + `orders`(L7)`confirmed/checked_in/cancelled`,聯集正好等於 spec 的六個值,也符合 `POST /holds/:id/confirm → 建訂單` 的 API 設計。註:`confirmed` 同時存在兩張表,是兩個真相來源,要靠應用層維持同步。
4. ❌ **L6**:`ux_seat_active` 是 partial unique index,`WHERE status = 'holding'` **只擋住 holding 狀態**。hold 一旦 confirm 變成 `confirmed`,就脫離索引範圍,同一個 `(event_id, seat_no)` 可以再被別人 `holding` → 座位重複。而 `order_items.seat_no`(L8)也沒有任何 unique 約束兜底。spec「座位不重複」規則在 schema 層是破的;至少要改成 `WHERE status IN ('holding','confirmed')`。
5. ✅ L4 `remaining INTEGER NOT NULL CHECK (remaining >= 0)`。
6. ✅ L8 `order_items.unit_price_cents` 存了單價快照,不用 JOIN `ticket_types`。
7. ❌ **L9**:`promo_codes` 不在 spec 的 17 條 API 裡,也沒有任何表引用它(`orders` / `order_items` 都沒有 `promo_code_id`)。非目標清單的前言講的就是這件事(「順手加」),而且 non-goals.md 自己說這是「五張表的專案」,現在有八張。其他三張(`refresh_tokens`、`order_items`、`seat_holds`)都能對到 spec 的需求(refresh 輪替、明細快照、保留十分鐘),只有 `promo_codes` 是無主的。
8. ✅ 八張表全部 `STRICT`。

**6/8 通過**

清單外順帶一提(不計分):整份 schema 沒有任何 `FOREIGN KEY`/`REFERENCES`,`member_id` / `event_id` / `order_id` / `ticket_type_id` 都是裸 INTEGER。D1 預設沒開 foreign key enforcement,所以這算刻意還是漏掉,得看 spec 有沒有講——目前 spec 沒提。
