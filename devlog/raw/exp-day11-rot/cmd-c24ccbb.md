---
description: 檢查 schema 的靜態約束
---

讀 `schema.sql`,逐條檢查下列約束,**不要修改任何檔案**,只回報:

1. **金額欄位是整數**,而且欄名帶單位(例如 `_cents`)。
   出現 `REAL` / `FLOAT` / `NUMERIC` 在金額欄位 = 失敗。
2. **時間欄位存 UTC**,型別一致(全部 INTEGER epoch 或全部 TEXT ISO,不可混用)。
3. **`status` 有 `CHECK` 約束**,而且列舉值與 `docs/spec.md` 的狀態機一致。
4. **座位有 `UNIQUE(event_id, seat_no)`**。
5. **名額有 `CHECK (remaining >= 0)`**。
6. **訂單明細存了價格快照**(單價欄位在 `order_items` 上,不是只靠 `ticket_type_id` JOIN)。
7. **沒有非目標清單以外的表**(對照 `docs/non-goals.md`)。
8. 有沒有用 `STRICT`(SQLite 3.37+)。

輸出格式:每條一行,`✅` 或 `❌ + 哪一行 + 為什麼`。
最後給一行總計:`n/8 通過`。

> ⚠️ 注意第 1 條的極限:它檢查得出「是不是整數」,
> **檢查不出「單位是元還是分」** —— 兩者都是合法的正整數。
> 單位屬於契約,不屬於 schema,這正是 Day 22 要講的事。
