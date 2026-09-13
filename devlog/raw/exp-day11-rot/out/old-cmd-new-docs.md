`schema.sql` 共 9 行、8 張表,對照 `docs/spec.md` 與 `docs/non-goals.md` 結果如下:

1. ✅ 金額欄位全是 `INTEGER` 且帶 `_cents`:`price_cents`(L4)、`total_cents`(L7)、`unit_price_cents`(L8)。沒有 `REAL`/`FLOAT`/`NUMERIC`。
2. ✅ 時間欄位全是 `INTEGER` epoch,沒有混用 `TEXT`:`created_at`/`expires_at`/`revoked_at`/`opens_at`/`deadline_at`/`early_bird_until`/`valid_until`。(是否為 UTC 屬於寫入方契約,schema 本身看不出來。)
3. ✅ 三個 `status` 都有 `CHECK`:`events`(L3)`draft/on_sale/closed/finished/cancelled` 與 spec 活動狀態機一致;`seat_holds`(L5)`holding/confirmed/expired/cancelled` + `orders`(L7)`confirmed/checked_in/cancelled`,聯集正好是 spec 的訂單狀態機。注意這條狀態機被拆到兩張表,`holding → confirmed` 的轉移跨表,`confirmed` 在兩邊都存在,同步得靠應用層。
4. ❌ **L6**:`CREATE UNIQUE INDEX ux_seat_active ON seat_holds(event_id, seat_no) WHERE status = 'holding'` —— 述詞只有 `holding`,少了 `confirmed`。`docs/spec.md` L160–167 明確要求 `WHERE status IN ('holding','confirmed')`,並警告只寫 `holding` 的後果:hold 一確認就離開索引述詞,**座位在確認完成那一刻反而失去保護**,別人可以再搶。這正是 spec 用實跑驗證過、點名不能犯的那個錯。
5. ✅ L4 `remaining INTEGER NOT NULL CHECK (remaining >= 0)`。
6. ✅ L8 `order_items.unit_price_cents INTEGER NOT NULL`,不是只靠 `ticket_type_id` JOIN 回 `ticket_types.price_cents`。
7. ✅ 8 張表(`members`、`refresh_tokens`、`events`、`ticket_types`、`seat_holds`、`orders`、`order_items`、`promo_codes`)都在範圍內;沒有金流、圖片、通知、候補、租戶之類的表。`refresh_tokens` 與 `promo_codes` 是 spec 規格層決定 #3、#4 明文要建的。
8. ✅ 8 個 `CREATE TABLE` 全部以 `STRICT` 結尾。附帶效果:`INTEGER` 欄位寫入時會拒絕非整數,第 1 條在執行期也有裁判。

**7/8 通過**

檢查清單以外、順手看到但沒算進分數的兩點:

- **L9 `promo_codes.pct`** 與 spec 打架:spec L110–124 定案優惠碼是**現金券**(「優惠碼 10000 分」「不被百分比稀釋」),schema 卻存百分比。這條同時呼應第 1 條的極限 —— 它是合法整數,靜態檢查放行,但單位跟契約對不上。另外 spec 規格層決定 #4 要求的 `event_id`(可 NULL = 全站)也沒有。
- 全檔沒有任何 `FOREIGN KEY`(`member_id`、`event_id`、`order_id`、`ticket_type_id` 都是裸 `INTEGER`)。不在這 8 條裡,是否要補屬於設計決定,只是提一下。

沒有修改任何檔案。
