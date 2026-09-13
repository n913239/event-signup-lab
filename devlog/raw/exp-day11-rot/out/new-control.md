讀的是 `schema.sql`(沒給路徑),對照 `docs/spec.md` 與 `docs/non-goals.md`。

1. ✅ 金額欄位全是 `INTEGER` 且帶單位:`ticket_types.price_cents`(L4)、`orders.total_cents`(L7)、`order_items.unit_price_cents`(L8)。沒有 `REAL`/`FLOAT`/`NUMERIC`。(`promo_codes.pct` L9 是百分比不是金額,不算在內 —— 但見文末備註。)
2. ✅ 時間欄位型別一致,全部 `INTEGER` epoch:`created_at`(L1/3/5/7)、`expires_at`/`revoked_at`(L2、L5)、`opens_at`/`deadline_at`(L3)、`early_bird_until`(L4)、`valid_until`(L9)。沒有混入 TEXT。epoch 本身無時區,「是 UTC」這點 schema 層面無從再驗。
3. ✅(有條件)`status` 三處都有 `CHECK`:
   - `events` L3 `('draft','on_sale','closed','finished','cancelled')` ↔ spec L68-70 五個值,不多不少。
   - `seat_holds` L5 `('holding','confirmed','expired','cancelled')` + `orders` L7 `('confirmed','checked_in','cancelled')`,**聯集**= spec L72-75 的 `{holding, confirmed, checked_in, expired, cancelled}`,不多不少。
   - 條件:spec 把這條狀態機標成「訂單」單一鏈,但 spec L54 又說「確認 → 建訂單」,所以拆成 hold/order 兩張表是合理讀法。若你堅持逐表比對,兩張表各自都缺值 —— 這個歧義在 spec,不在 schema。
4. ❌ L6:`CREATE UNIQUE INDEX ux_seat_active ON seat_holds(event_id, seat_no) WHERE status = 'holding';` —— 述詞**沒有 `confirmed`**。hold 一 confirm、status 離開述詞,索引項釋放,已確認的座位可被別人再 hold。spec L160-163 已經明寫正確版本 `WHERE status IN ('holding','confirmed')`,L165-167 也點名這個坑。
5. ✅ L4 `remaining INTEGER NOT NULL CHECK (remaining >= 0)`。
6. ✅ L8 `order_items.unit_price_cents INTEGER NOT NULL`,價格快照在明細列上,不靠 `ticket_type_id` JOIN。
7. ✅ 8 張表:`members`、`refresh_tokens`、`events`、`ticket_types`、`seat_holds`、`orders`、`order_items`、`promo_codes`(L1-9)。對照 non-goals 15 條(L9-23),沒有付款、推播、候補、圖片、多租戶等表;`refresh_tokens` 與 `promo_codes` 是 spec 規格層決定 3、4(L104-105)明令要建的。
8. ✅ 全部 8 張表結尾都有 `STRICT`(L1、2、3、4、5、7、8、9)。

**7/8 通過**

備註(不在 8 條內,但對 Day 22 的比對有用):
- 第 1 條的極限如你所說:欄名 `_cents` + spec L117-121 的「全程整數分」構成契約,但 schema 只能證明「是整數」,存元進去一樣合法。
- `promo_codes`(L9)與 spec L105 有出入:spec 要 `event_id`(可 NULL = 全站),schema 沒有;spec L124 說優惠碼是**現金券**(減 10000 分),schema 存的卻是 `pct` 百分比。這是 spec 對齊問題,不是本次 8 條的範圍。
- 全 schema 沒有任何 `FOREIGN KEY`,同樣不在檢查項內,但拿去比無菌室版本時值得看。
