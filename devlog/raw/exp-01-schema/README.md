# 實驗 01:schema(Day 22)

- 日期:2026-09-27;模型:claude-opus-5-5(`claude -p`,版本見 `claude-version.txt`)
- 無菌室:repo 外的空目錄(`git init` 後什麼都沒有);**沒給** CLAUDE.md、`docs/`、`specs/`、`tests/schema.test.js`、七個陷阱
- prompt(逐字,與 Day 22 草稿引的那段一致):`prompt.md`
- 工具:Write / Edit / Read;7 turns、$0.505、121 秒
- 它交出:`schema.sql`(212 行,含 trigger 與 view)、`flows.sql`(流程 SQL 範本)、`test.sh`(用暫存 DB 跑情境)、`result.md`(它的說明原文)、`run.json`

## 對照版本

repo 根的 `schema.sql`(commit `edb480d`):作者起稿、寫作 session 補三處、作者審。**寫作 session 讀過 data-model、schema.test 與陷阱,是「看過考題的 AI」**,所以 Day 22 比的是「看過規格的 AI vs 只拿一句話的 AI」,不稱作者版(EXPERIMENT-PROTOCOL 2026-09-27)。

## 用同一把尺量

| 版本 | 結果 |
|---|---|
| `schema.sql` 原樣 | **在 D1 上載入失敗**:第 7 行 `PRAGMA journal_mode = WAL` → `D1_ERROR: not authorized: SQLITE_AUTH`。prompt 只說 SQLite,它照一般 SQLite 的習慣寫 |
| `schema.d1.sql`(只拿掉兩行 PRAGMA,其餘原樣) | `tests/schema.test.js` **4 綠 7 紅** |

紅的七項:

| # | 原因 |
|---|---|
| ① 欄名帶單位 | `ticket_types.price`、`reservation_items.unit_price`、`reservations.total_amount` 都是整數,但沒寫單位;它的檔頭寫「最小貨幣單位,例如『分』或『元』」—— **單位沒有決定** |
| ③ 列舉不多不少 | 活動狀態是 `published` 不是 `on_sale`;另有 `held`、`valid`、`void`,以及 `is_seated IN (0,1)` 被算進列舉 |
| ④ 部分唯一索引 | 它不用索引擋重座:鎖直接記在 `seats` 上,搶位靠 `UPDATE … WHERE reservation_id IS NULL OR lock_expires_at <= unixepoch()` + `changes()` |
| ⑤ `CHECK (remaining >= 0)` | 它沒有 remaining 欄:名額由 trigger 現場數 |
| ⑥ 明細表的單價欄 | 有快照(`reservation_items.unit_price`),但表名不叫 order_items —— **這項與 ⑦ 依賴本 repo 的命名,對沒看過規格的一方不公平,文章要註明** |
| ⑦ 規格以外的表 | `seats`、`reservations`、`reservation_items`、`tickets` 不在白名單(同上,命名依賴) |
| ⑧ STRICT | 六張表都沒有 STRICT |

## 測試以外看得到的分歧(Day 22 素材)

- **時間單位**:它存 epoch **秒**,用 SQL 的 `unixepoch()` 當現在時間 —— 時間在 SQL 裡自己取,不是參數(硬規則 2 在資料層的版本)
- **交易**:它的流程靠 `BEGIN IMMEDIATE`;D1 的 API 沒有互動式交易,只有 `db.batch()`
- **金額單位**:整數,但「分或元」留白
- **過期判定**:查詢時比 `lock_expires_at <= unixepoch()`,不靠排程 —— 跟本專案「搶位那一批先翻 status」是不同但也成立的做法

## 裁判本身的修正(同日)

量它的時候發現 `tests/helpers/db.js` 與 `schema.test.js` 的切句器碰到 `CREATE TRIGGER … BEGIN … END;` 會把本體切碎。
改成共用的 `tests/helpers/sql.js`(trigger 整塊一句、先剝整行註解);修正後本 repo 的 schema 照樣 11/11、`schema-selftest` 全過。
