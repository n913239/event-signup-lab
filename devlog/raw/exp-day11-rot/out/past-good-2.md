**`/check-schema` 結果**(`schema.sql`,9 行,未修改任何檔案)

1. ✅ 金額欄位全是 `INTEGER` 且帶單位:`price_cents`(L4)、`total_cents`(L7)、`unit_price_cents`(L8)。沒有 `REAL`/`FLOAT`/`NUMERIC`。(`promo_codes.pct` 是百分比不是金額,不算。)
2. ✅ 時間欄位全部 `INTEGER` epoch,無混用:`created_at`/`expires_at`/`revoked_at`/`opens_at`/`deadline_at`/`early_bird_until`/`valid_until`。epoch 本身無時區,等同 UTC。
3. ✅ `status` 三處都有 `CHECK`。`events`(L3)= `draft/on_sale/closed/finished/cancelled`,與 spec 一致。spec 的「訂單」狀態機被拆成兩張表:`seat_holds`(L5)= `holding/confirmed/expired/cancelled`,`orders`(L7)= `confirmed/checked_in/cancelled`,聯集剛好等於 spec 的五個狀態,`holding→confirmed` 這一步跨表。列舉值沒有多也沒有少。
4. ✅ L6 `CREATE UNIQUE INDEX ux_seat_active ON seat_holds(event_id, seat_no) WHERE status IN ('holding','confirmed')`。是 partial unique index 而非表級 `UNIQUE(...)`,但這是對的形式 —— 純 `UNIQUE` 會讓 expired/cancelled 的座位永遠放不掉。
5. ✅ L4 `remaining INTEGER NOT NULL CHECK (remaining >= 0)`。
6. ✅ L8 `order_items.unit_price_cents`,不依賴 `ticket_type_id` JOIN 取價。
7. ❌ L9 `promo_codes`:spec 的 17 條 API、狀態機、硬性約束都沒提到折扣碼(票種只有 `early_bird_until` 這個早鳥條件,L4 已涵蓋)。`non-goals.md` 沒有一條明寫「不做折扣碼」,但它的開頭就是在防這種「順手加」,且文件自稱「五張表的專案」。這張表沒有任何一條測試能裁決的規則在背後撐它。其餘 7 張表(`members`/`refresh_tokens`/`events`/`ticket_types`/`seat_holds`/`orders`/`order_items`)都能對回 spec。
8. ✅ 9 張 `CREATE TABLE` 全部帶 `STRICT`。

**7/8 通過**

補一句第 1 條的極限,如 skill 所提醒:這裡只能確認 `_cents` 是整數,確認不了寫進去的值真的是「分」而不是「元」—— 那要靠 `src/presentation/` 的轉換契約和測試,schema 管不到。
