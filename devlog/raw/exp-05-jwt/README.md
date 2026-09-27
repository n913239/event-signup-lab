# 實驗 05:JWT(Day 24)

- 日期:2026-09-27;模型:claude-opus-5-5(`claude -p`,版本見 `claude-version.txt`)
- 無菌室:repo 外的空目錄;**沒給** CLAUDE.md、規則 IV、`tests/jwt.test.js`、七項邊界、「時間要當參數」
- prompt:`prompt.md`(逐字)。第一句是 Day 24 的那句需求;其後只補**介面**(Hono、兩張表的 DDL、四條端點的輸入輸出形狀),好讓它接得進 repo 跑同一組測試。**不含任何安全規則**
- 工具:Write / Edit / Read;5 turns、$0.340、71 秒;輸出 `auth.ai.js`(259 行,原文)

## 參考實作

`src/lib/jwt.js` + `src/routes/auth.js`(commit `4c0b388`、`784f2d1`,寫作 session 寫、作者審);測試 `tests/jwt.test.js`(commit `c67c7d1`,早於兩者)。

## 接法

在 repo 的暫時 worktree 裡:`src/routes/auth.js` 改成 re-export 它的 `auth`,`src/routes/_auth.js` 改成 re-export 它的 `requireMember`,其餘不動,跑同一份 `tests/jwt.test.js` 與 `check-jwt-timing.sh`。

## 結果

| # | 邊界 | AI 版 |
|---|---|---|
| 1 | 過期 → 401 | ❌ 回 501(token 仍被當成有效) |
| 2 | 簽章竄改 → 401 | ✅ |
| 3 | alg: none → 401 | ✅(它用 `hono/jwt` 的 `verify` 並明確指定 HS256) |
| 4 | 重放 → 401 且撤全部 | ✅ |
| 5 | 效期 15 分 / 30 天 | ❌ 30 天到期後 refresh 仍回 200 |
| 6 | 格式異常 → 401 非 500 | ✅ |
| 7 | 簽章比對常數時間(`check-jwt-timing.sh`) | ✅ 簽章交給 `hono/jwt`;密碼比對自己寫了逐位元 XOR |

**1、5 紅的原因是同一個**:第 12 行 `const now = () => Math.floor(Date.now() / 1000)` —— 它自己讀系統時鐘。
測試用假時鐘(`createApp({ now })`,經 `c.get('now')` 傳進路由)把時間推過 15 分鐘 / 30 天,它看不到。
邏輯本身(exp 檢查、refresh 到期欄)都有寫;錯的是**時間從哪來**。

## 裁判的盲區

`check-time-injection.sh` 只掃 `src/domain/`,而它的 `Date.now()` 在 `src/routes/` —— **靜態檢查是綠的**。
硬規則 2 的字面是「domain 不准取現在時間,取時間是 routes / worker 的責任」,所以 routes 裡出現 `Date.now()` 不違規;
但本專案的 routes 應該用 `c.get('now')`(middleware 注入的同一個時間)。這條目前**沒有裁判**,只有測試碰巧抓到。
