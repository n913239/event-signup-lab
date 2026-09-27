# 驗過的 / 沒驗過的

> 這份檔案的存在理由:v3 的四篇文章都寫「壓測腳本當裁判」,
> 而那支腳本**根本不存在** —— `scripts/` 裡沒有 race.sh,
> 真實併發從頭到尾沒跑過。**寫進文章的東西必須在左欄。**

規則:自己實際跑過、有輸出可貼的放 ✅;推論、預期、「應該可以」放 ❌。
**❌ 欄的東西不准寫成結果。**

## ✅ 實際跑過

| 日期 | 項目 | 證據 |
|---|---|---|
| 2026-09-04 | 三支靜態檢查的自我測試(含簽章反向寫法) | `sh scripts/self-test.sh` 全過 |
| 2026-09-10 | 五支靜態檢查全面補漏補誤報:剝註解、表名解析、變數名擴大、整數百分比 | `self-test.sh` **40/40** |
| 2026-09-10 | 部分唯一索引行為(述詞含 `confirmed`、過期後可重佔、`ON CONFLICT` 的 `changes=0`) | SQLite 3.51.0 實跑,輸出見 `docs/spec.md` |
| 2026-09-10 | 多座 hold 的原子性:裸 `INSERT` 全有全無 vs `DO NOTHING` 半成功 | 同上 |
| 2026-09-10 | schema 裁判(11 條斷言)先於 schema 寫好,並自我測試過 | `npm run test:schema:selftest`(壞 schema 各紅在對應那條 + good 不誤報) |
| 2026-09-27 | schema(作者起稿)+ 18 條 endpoint 全部實作 | `npx vitest run` **245/245**(23 個測試檔);契約測試 `tests/contract.test.js` |
| 2026-09-27 | 靜態檢查擴到 web 與 iOS(`check-money.sh` 掃 `web/src`、`ios/`) | `self-test.sh` **41 筆探針**(28 筆要抓到、13 筆不得誤報)全過;`npm run check:all` 五支全綠 |
| 2026-09-27 | 時間注入收緊:讀時鐘只准在 `src/app.js` / `src/worker.js`,也擋 SQL 自己取時間與 `hono/jwt`(`193436a`,Day 24 發現的盲區) | `self-test.sh` **47 筆探針**(32 筆要抓到、15 筆不得誤報)+ 乾淨狀態 5 項全過;把 exp-05 的 AI 版 JWT 放進 `src/routes` 會紅 |
| 2026-09-27 | schema 裁判「列舉不多不少」抓太寬修正(`c6aa609`) | `good.sql` 加布林旗標探針:舊版紅、新版綠 |
| 2026-09-27 | 開賣那一秒(線上)與三方時鐘對照 | 最後被拒 −58 ms、第一次成功 +39 ms;四個時鐘來源同秒(`devlog/raw/day26-opening/`) |
| 2026-09-27 | 金額:擇優不疊加、整數分 | `tests/domain/money.test.js`;**fuzz 20,000 組**(seed 20260927)五條不變條件 + 獨立對照算法 0 違反,四個突變全紅(`devlog/raw/exp-02-money/README.md`) |
| 2026-09-27 | 時間注入、價格快照(改價後既有訂單金額不變) | `tests/domain/time-rules.test.js`、`tests/routes/orders.test.js`;`check-time-injection.sh`、`check-price-snapshot.sh` |
| 2026-09-27 | 併發(單一 process 閘門):超賣、座位唯一、多座全有全無、TTL 三方競態(原持有人一律輸)、同 hold 兩個 confirm、PATCH 名額與加票種同時到 | `npm run test:race` 7/7,每條重跑 5 次一致 |
| 2026-09-27 | **真實併發(多連線打遠端 Worker)** | `scripts/race.sh` 5 輪 × 20 條連線:同座位恰 1 人、名額 5 恰 5 人、remaining 0(`devlog/raw/race-2026-09-27.txt`) |
| 2026-09-27 | JWT:HS256 用 `crypto.subtle.verify`、refresh 輪替與重放撤全部、logout、登入鎖定 | `tests/jwt.test.js` 6 個 + `check-jwt-timing.sh`;`tests/routes/auth.test.js`、`login-lockout.test.js` |
| 2026-09-27 | 端到端(本機) | `scripts/smoke.sh` 11/11 |
| 2026-09-27 | 部署:Worker + D1 + Cron(`*/5`)+ Pages | `/health` 200;Cron 每 5 分鐘清過期 hold、轉 finished |
| 2026-09-27 | iOS 模擬器接線上走三畫面 | XCUITest 兩次 passed,截圖 `devlog/raw/t055-2026-09-27/` |
| 2026-09-27 | SC-007:curl 與 iOS 對同一個 GET 逐欄相同 | `scripts/compare-clients.sh`:`/events` 2 筆 12 欄、`/orders` 1 筆 28 欄全相同 |
| 2026-09-27 | web 與 iOS 金額顯示同一份向量 | `tests/fixtures/money-format.json` 14 組,vitest 與 `swift test` 各一支;de_DE 探針會紅 |
| 2026-09-27 | SC-008「我的票券」讀取次數 | 遠端 D1 `rows_read` **16**(1 張訂單 4 席),五表皆走索引 |
| 2026-09-27 | 免費額度(Day 28) | D1 過去 24 小時 rows read 5,711 / written 1,711 / 193 kB;Workers 530 次請求、0 錯誤(dashboard);N+1 對照 JOIN 1 次 60 列 vs N+1 27 次 52 列(`devlog/raw/day28-free-tier/`) |
| 2026-09-27 | Xcode 27.0 MCP 在本專案重跑 | 53 支工具;建置失敗時 `RunAllTests` 回 `isError`;全部跳過時 `failed 0` 且 `passed 0`(`devlog/raw/exp-day29-xcode-mcp/`) |
| 2026-09-27 | push 前資安掃描 | gitleaks(歷史 141 commits:僅測試假金鑰)、`npm audit --omit=dev` 0、Fable 獨立複查 |

## ❌ 尚未驗證 / 刻意不做

| 項目 | 狀態 |
|---|---|
| web 畫面的自動化走查 | web 只有 `smoke.sh` 打 API 與人工操作,沒有瀏覽器自動化測試 |
| 限速(登入以外) | 刻意不做(非目標 / 刻意保留的醜);email 可被列舉、token 存 localStorage 同屬已知取捨 |
| dev 相依的 2 個 moderate(vitest 鏈) | `npm audit` 顯示,只影響開發環境;production 相依 0 |
| JWT「七項邊界外部清單」 | 2026-09-27 作者改定:不再作為驗收,改由 repo 內 6 個測試 + `check-jwt-timing.sh` 裁定 |

## 已知的坑(踩過,留著提醒)

| 日期 | 事件 |
|---|---|
| 2026-09-27 | 當天新寫的三支 shell 腳本裡有三個**假綠燈**(smoke 的 brace expansion、race 的子 shell、race 的 grep 子字串),全在第一次實跑前後抓到 —— 詳見 `devlog/LEDGER.md` |
| 2026-09-27 | CI 的併發測試被 vitest 預設 5 秒逾時判紅(runner 慢),程式是對的;逾時放寬到 30 秒 |
| 2026-09-10 | `check-price-snapshot.sh` 第一版以單引號切開 SQL,結果 `SET status = 'confirmed', amount_cents = 0` 在 `'confirmed'` 那裡被切斷,**金額欄逃掉了**。改成在每個 `UPDATE` 前斷行,一行一個語句 |
| 2026-09-09 | `check-concurrency.sh` 第一版只 grep `changes` 這個字,而測資的**註解**裡剛好寫著「但沒檢查 changes」—— **註解餵飽了檢查**。改成要求真的是屬性存取 |
| 2026-09-04 | 靜態檢查第一版用 `rg`,而 `rg` 在 `sh` 下不存在(互動 shell 的 function),加上 `2>/dev/null` 吃掉錯誤 → **三支檢查因為工具不存在而全部靜默通過**。改用 POSIX `grep`,並加 `self-test.sh` 強制每支檢查證明自己抓得到 |
