# 實驗 03:時間判定(Day 26)

- 日期:2026-09-27;模型:claude-opus-5-5(`claude -p`,Claude Code 版本見 `claude-version.txt`)
- 無菌室:repo 外的空目錄(`git init` 後只有 `brief.md`);**沒給** CLAUDE.md、`docs/`、`specs/`、測試、硬規則 2
- 工具:Write / Edit / Read;4 turns、$0.185、28 秒
- prompt:`prompt.md`(逐字);輸出:`time-rules.ai.js`(原文);完整 JSON:`run.json`

## 參考實作(寫作 session 寫、作者審,2026-09-27 起不稱「作者版」,見 EXPERIMENT-PROTOCOL)

`src/domain/time-rules.js`,commit `30b0228`;測試 `tests/domain/time-rules.test.js`,commit `04a9475`(先紅)。

## 用同一份測試與裁判量 AI 版

| 裁判 | 結果 |
|---|---|
| `tests/domain/time-rules.test.js`(15 個) | **14 綠 1 紅**:`holdExpiresAt` 參數順序是 `(minutes, now)`,測試傳 `(now, ttl)` |
| `npm run check:time` | **❌**:四個函式都寫成 `now = Date.now()` 預設值 |

## 差異

它**沒有**把時間寫死 —— 每個函式都收 `now`,邊界(含起點、不含終點)也全對。
但它給 `now` 一個預設值 `Date.now()`。這一個寫法:

- **測試抓不到**:測試永遠會傳 `now`,預設值從來不會被用到,所以 14 個跟時間有關的邊界測試全綠。
- **靜態檢查抓得到**:`check-time-injection.sh` 在 `src/domain/` 看到 `Date.now` 就紅。

呼叫端哪天忘了傳 `now`,domain 就會自己讀時鐘 —— 而那正是硬規則 2 要擋的事,也是「剛好等於開賣」測不到的起點。
