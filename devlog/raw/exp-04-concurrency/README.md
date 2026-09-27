# 實驗 04:併發 holds.js(Day 27)

- 日期:2026-09-27;模型:claude-opus-5-5(`claude -p`,版本見 `claude-version.txt`)
- 無菌室:repo 外空目錄。prompt(`prompt.md`,逐字)給了行為契約 FR-030–035、四個函式的介面,以及 `ticket_types` / `seat_holds` 的 DDL 與兩個部分唯一索引(接得進同一份測試的最低需要)
- **沒給**:research.md R6 的三個候選、硬規則 3「併發判斷寫在 WHERE」、`check-concurrency.sh`、測試、作者定的錯誤優先順序
- 5 turns、$0.393、90 秒;輸出 `holds.ai.js`(226 行,原文)

## 對照

`src/lib/db/holds.js`(commit `eb5bf59`):**規則作者定**(R6 用一個 batch 靠 CHECK 回滾、建 hold 時扣名額、到期那刻原持有人輸、座位衝突優先回 seat_taken),程式寫作 session 寫。

## 結果

| 量什麼 | AI 版 |
|---|---|
| `concurrency.test` + `routes/holds.test` + `routes/orders.test`(31 個)× 5 次 | **31/31,5 次都一樣** |
| `check-concurrency.sh`、`check-time-injection.sh` | ✅ |
| 補上「座位衝突與名額不足同時發生 → seat_taken」之後 | **❌ 回 sold_out** |

## 差異

1. **它走了同一條路。** 一個 `db.batch()`、先還過期名額再翻過期(FR-033 釋放與搶到在同一次操作)、靠 `CHECK (remaining >= 0)` 與唯一索引拋錯回滾、錯誤訊息翻成代碼 —— 跟作者選的 R6 (a) 一樣。DDL 裡的 CHECK 與部分唯一索引等於把答案的一半給了它;它讀懂了,也用對了。
2. **唯一的差別是順序:它先扣名額再插座位。** 兩種衝突同時發生時,它回 `sold_out`,作者定的是 `seat_taken`。這條規則原本**沒有任何測試**,所以 31 個測試連跑 5 次全綠 —— 補上那一條測試之後才紅。
3. 還名額時它多包了一層 `MIN(capacity, …)`:名額永遠不會還超過上限。防禦性寫法,但也會把「還多了」這種 bug 蓋掉。

**Day 27 的重點不在 AI 寫不寫得出併發 —— 給了 schema,它寫得出來。在於「規則沒寫成測試,就等於沒定」:作者心裡的優先順序,在補那條測試之前,對 AI 版和對作者版都一樣不存在。**
