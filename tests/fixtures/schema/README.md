# schema 裁判的自我測試

`tests/schema.test.js` 的 11 條斷言,每一條都要證明**它會紅**。
一支從不亮紅燈的檢查,跟沒有檢查是同一件事(`scripts/self-test.sh` 同一個道理)。

`good.sql` 是一份刻意做對的 schema;其餘每一份都只壞一個地方:

| 檔案 | 壞在哪 | 應該紅在 |
|---|---|---|
| `good.sql` | — | 全綠(11 passed) |
| `bad-index.sql` | 部分索引述詞只寫 `'holding'`,漏了 `confirmed` | ④ |
| `bad-float.sql` | 金額欄用 `REAL` 而且名字沒帶單位 | ① ×2 |
| `bad-strict.sql` | 沒有 `STRICT` | ⑧ |
| `bad-remaining.sql` | 名額少了 `CHECK (remaining >= 0)` | ⑤ |
| `bad-snapshot.sql` | 明細表沒有自己的單價欄 | ⑥ |
| `bad-time.sql` | 時間欄型別混用(INTEGER + TEXT) | ② |
| `bad-nocheck.sql` | `status` 沒有 `CHECK` | ③-1 |
| `bad-enum.sql` | 列舉多一個 `refunded`(狀態機以外) | ③-2 |

跑法:

```bash
for f in tests/fixtures/schema/*.sql; do
  echo "$f"; SCHEMA=$f npx vitest run tests/schema.test.js
done
```

> ⚠️ `good.sql` **不是**答案,也不是建議的 schema —— 它只是一份「能通過這 11 條」的
> 樣本,用來證明斷言不會亂紅。作者自己的 `schema.sql` 怎麼設計是另一回事。
> 這份 fixture 刻意不放進 `schema.sql`,免得變成抄的對象。
