**`/check-schema` 結果**(`schema.sql`,9 行;只讀不改)

1. ✅ 金額欄位全是 `INTEGER` 且帶單位:`price_cents`(L4)、`total_cents`(L7)、`unit_price_cents`(L8)。沒有 REAL/FLOAT/NUMERIC。(`promo_codes.pct` 是百分比不是金額,不算。)
2. ✅ 時間欄位型別一致:`created_at`/`expires_at`/`revoked_at`/`opens_at`/`deadline_at`/`early_bird_until`/`valid_until` 全部 `INTEGER` epoch,沒有混 TEXT。— 附註:epoch 本身無時區,「存 UTC」是寫入端契約,schema 檢查不出。
3. ✅ `events.status`(L3)`CHECK IN ('draft','on_sale','closed','finished','cancelled')` 與 spec 活動狀態機完全一致。訂單狀態機被拆成兩張表:`seat_holds.status`(L5)`holding/confirmed/expired/cancelled` + `orders.status`(L7)`confirmed/checked_in/cancelled`,聯集等於 spec 的 `holding→confirmed→checked_in / expired / cancelled`,無多餘值。— 附註:`confirmed` 同時出現在兩張表,是兩個真相來源,要靠應用層同步。
4. ❌ **L6**:沒有 `UNIQUE(event_id, seat_no)`,只有部分索引 `CREATE UNIQUE INDEX ux_seat_active ON seat_holds(event_id, seat_no) WHERE status = 'holding'`。`WHERE` 只涵蓋 `holding`,**hold 一旦變 `confirmed` 就脫離索引**,同一座位可以再被別人 `holding` 一次 → 確認後仍會撞位。部分索引本身是合理做法(expired/cancelled 要釋放座位),但條件至少要是 `status IN ('holding','confirmed')`。另外 `order_items.seat_no`(L8)完全沒有唯一性保護。
5. ✅ L4 `remaining INTEGER NOT NULL CHECK (remaining >= 0)`。
6. ✅ L8 `order_items.unit_price_cents INTEGER NOT NULL`,價格快照在明細上,不用 JOIN `ticket_types`。
7. ❌ **L9** `promo_codes`:`docs/spec.md` 17 條 API 沒有任何一條碰折扣碼,早鳥已經用 `ticket_types.early_bird_until` 涵蓋;`non-goals.md` 自己寫「五張表的專案」且開頭就警告 AI 會順手擴張範圍。這張表沒有裁判(沒有測試能裁決的規則對應),依 non-goals 的判準是負分。其餘 7 張表沒有實作任何列出的非目標(無推播、無多租戶、無圖片、無掃碼核銷表)。
8. ✅ 全部 8 張 `CREATE TABLE` 都有 `STRICT`。

**6/8 通過**

> 提醒第 1 條的極限:`_cents` 只是欄名,schema 證明得了「是整數」,證明不了寫入端真的存的是分而不是元。這條契約要靠 `src/presentation/` 邊界的測試裁決,不是這支 skill。
