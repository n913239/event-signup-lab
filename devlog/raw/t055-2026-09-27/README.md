# T055:iOS 接線上、三端比對、rows_read(2026-09-27)

對象:線上 Worker `https://event-signup.n913239.workers.dev`(commit `8a285e0` 部署)。
示範資料:`race-staff@example.com`(SQL 升 staff)建「示範活動:秋季音樂會」;`demo-buyer@example.com` 訂 C3–C6(4 席,單價 1,234.50,團體 10%)→ 應付 444420 分。兩個帳號密碼隨機、沒進 repo。

## 1. iOS 模擬器接線上(XCUITest,`ios/App/EventSignupAppUITests`)

iPhone 16 Pro 模擬器(iOS 18.5)。登入 → 活動 → 票券,連跑兩次都 passed(17.7s / 18.0s)。截圖:`ios-1-login.png`、`ios-2-events.png`、`ios-3-tickets.png`。
票券畫面顯示 `NT$4,444.20`(千分位固定逗號,`tests/fixtures/money-format.json`)。
第一次跑踩到兩件事:① 模擬器 Keychain 留著上次的 refresh token,第二次一開就是已登入 → 測試改成先登出;② 截圖裡 10 個 race 活動還在「開賣中」→ `race.sh` 截止時送成 GET,已修。

## 2. curl vs iOS 逐欄比對(`scripts/compare-clients.sh`)

```
✅ GET /events:2 筆,curl 與 iOS 逐欄相同(欄位數 12)
✅ GET /orders:1 筆,curl 與 iOS 逐欄相同(欄位數 28)
```
iOS 端是產生的 client **解碼後再編回 JSON**。第一次比對 `promo_code: null` 在 iOS 端不見:Swift `JSONEncoder` 省略 nil 的 Optional,解碼值仍是 nil —— 比對時 null 與缺 key 視為相同,其他不正規化。
web 沒有另外比:`web/src/api.js` 直接 `res.json()`,不轉換,等同 curl;顯示層的金額格式由共用向量保證兩端一致。

## 3. rows_read(SC-008)

「我的票券」那一句(`src/lib/db/orders.js` 的 SELECT_ORDER + member 條件),遠端 D1 實跑:**rows_read = 16**(1 張訂單、4 席;含一次用 email 找 member id 的讀取,實際 API 是直接 bind id)。
`EXPLAIN QUERY PLAN`:orders / members / events / order_items / ticket_types 五張表都是 `SEARCH … USING INDEX`,ORDER BY 用 temp B-tree;一次查詢、沒有 N+1。
