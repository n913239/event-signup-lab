---
description: 檢查 schema 的靜態約束
---

讀 `$ARGUMENTS`(沒給就讀 `schema.sql`),逐條檢查下列約束,
**不要修改任何檔案**,只回報:

> 吃路徑參數是為了 Day 22:那天要拿同一套約束去打**無菌室 session 交出的
> 那份 schema**(`devlog/raw/exp-01/schema.sql`),再跟我自己的版本比。
> 寫死一個檔名的檢查,只能檢查自己人。

1. **金額欄位是整數**,而且欄名帶單位(例如 `_cents`)。
   出現 `REAL` / `FLOAT` / `NUMERIC` 在金額欄位 = 失敗。
2. **時間欄位存 UTC**,型別一致(全部 INTEGER epoch 或全部 TEXT ISO,不可混用)。
3. **`status` 有 `CHECK` 約束**,而且列舉值與 `docs/spec.md` 的狀態機**不多不少**一致。
   少一個值 = 有狀態進不來;多一個值 = 有狀態沒人處理。兩種都是失敗。
4. **座位的唯一性由部分唯一索引保證**:
   `UNIQUE INDEX … ON seat_holds(event_id, seat_no) WHERE status IN ('holding','confirmed')`。
   ⚠️ 述詞**必須含 `confirmed`** —— 只寫 `'holding'` 的話,hold 一確認、
   狀態離開述詞,索引項就釋放,已確認的座位反而失去保護(實跑驗證過)。
   普通的 `UNIQUE(event_id, seat_no)` 判 ❌:過期列會一直佔著 key,座位無法重佔。
5. **名額有 `CHECK (remaining >= 0)`**。
6. **訂單明細存了價格快照**(單價欄位在 `order_items` 上,不是只靠 `ticket_type_id` JOIN)。
7. **沒有非目標清單以外的表**(對照 `docs/non-goals.md`)。
8. 有沒有用 `STRICT`(SQLite 3.37+)。

輸出格式:每條一行,`✅ + 依據的哪一行` 或 `❌ + 哪一行 + 為什麼`。
**通過也要指出行號** —— 說得出通過、指不出依據,就是沒有真的看過。
最後給一行總計:`n/8 通過`。

> ⚠️ 注意第 1 條的極限:它檢查得出「是不是整數」,
> **檢查不出「單位是元還是分」** —— 兩者都是合法的正整數。
> 單位屬於契約,不屬於 schema,這正是 Day 22 要講的事。
