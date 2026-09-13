# Research:技術決定(Phase 0)

**Feature**: 001-event-signup-full · **Date**: 2026-09-14

Technical Context 沒有 NEEDS CLARIFICATION(技術棧由使用者指定)。本檔記的是**棧內**要拍板的做法,
每條:決定 / 理由 / 放棄的替代。標 **[作者手寫區]** 的條目只定介面與驗收,不定實作。

## R1. web 工具鏈與部署形狀

**決定**:`web/` 用 Vite(vanilla JS,ESM,不上框架)+ Tailwind v4 + daisyUI v5(用內建主題,不自訂);
建置產物 `web/dist` 部署到 Pages。API 與 web **不同源**:Worker 開 `hono/cors`,允許來源 = Pages 網域 + `http://localhost:5173`;
本機開發 Vite `server.proxy['/api'] → http://127.0.0.1:8788`。
Token 存放:access 放記憶體,refresh 放 `localStorage`;`api.js` 在 401 時自動 refresh 一次再重試。

**理由**:五個畫面、不追求 UI(非目標 15),框架是負分;Tailwind v4 的 CDN 版只供開發,正式要 build,所以要 Vite。
不同源 + bearer 是最少活動零件的做法;httpOnly cookie 跨 Pages / Workers 兩個網域要處理 `SameSite=None` 與 CSRF,不值得。

**放棄**:Pages Functions 代理 API(多一層要維護,而且裁判掃不到);同一 Worker 同時服務靜態檔(使用者指定 Web = Pages)。

## R2. 自製 JWT、密碼、refresh token

**決定**:
- JWT:HS256,`crypto.subtle.sign` / **`crypto.subtle.verify`**(規則 IV 的唯一允許實作)。key 從 `env.JWT_SECRET`(`.dev.vars` / `wrangler secret`)以 `subtle.importKey('raw', …, {name:'HMAC', hash:'SHA-256'})` 匯入。
  claims:`sub`(member id)、`role`、`iat`、`exp`(= iat + 15 min);`verify(token, key, now)` 的 `now` 由 route 傳入。
- 密碼:PBKDF2-SHA256,`subtle.deriveBits`,**100,000 次**(Workers 對 PBKDF2 的上限),16 bytes salt,存 `pbkdf2$100000$<salt>$<hash>`;比對用 `subtle.verify` 不可行(不是簽章),改為**再算一次後以 `crypto.subtle.timingSafeEqual`** —— 這是 Workers 提供的常數時間比對;`check-jwt-timing.sh` 只擋 `===` / `!==` / `localeCompare`,`timingSafeEqual` 不會被誤判。
- refresh token:32 bytes 隨機(`crypto.getRandomValues`)base64url;DB 只存 `SHA-256(token)`(`token_hash`)。
  輪替:`/auth/refresh` 在一個 batch 裡 `UPDATE refresh_tokens SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?` + `INSERT` 新列;`changes = 0` → 進入重放判斷:若該 hash 存在但已 `revoked_at`,**撤銷該成員全部** refresh(C17)並回 401。
  效期 30 天(C16)。查找 `WHERE token_hash = ?` 是 SQL 等值比對,不是常數時間,但比的是隨機值的雜湊,攻擊者拿不到可逐位元試探的秘密。

**理由**:Workers 沒有 Node `crypto` 的 bcrypt/argon2,PBKDF2 是 WebCrypto 唯一原生選項;`timingSafeEqual` 是 Workers 特有 API,測試環境 miniflare 也有。

**放棄**:RS256(單一服務不需要非對稱);第三方 JWT 套件(非目標 12:自製 JWT 就是題目);`bcryptjs`(純 JS 實作在 Worker CPU 限制下慢且無必要)。

## R3. 錯誤形狀與狀態碼

**決定**:所有錯誤 `{ error: <snake_case 代碼>, server_now: <epoch ms> }`,沿用現有 `app.js` 的形狀;不帶人話訊息(刻意保留的醜)。

| 碼 | 用途 | 代碼例 |
|---|---|---|
| 400 | 輸入驗證(缺欄、型別、範圍、`seat_no` 格式、`hold_ttl_minutes` 不在 5–30) | `invalid_input` |
| 401 | 無 / 過期 / 壞簽章的 access;refresh 無效或重放 | `unauthorized`、`refresh_replayed` |
| 403 | 角色或 owner 不符 | `forbidden` |
| 404 | 資源不存在或不屬於本人(本人才看得到的資源,不存在與無權一律 404,避免枚舉) | `not_found` |
| 409 | 狀態衝突:座位已被佔、已有有效 hold、票種名額不足、活動不在可報名狀態 / 時間、hold 已過期、`cancelled` / `checked_in` 終態、名額 < 已售、票種名額總和 > 100、優惠碼不適用 / 已用過 / 過期、email 已存在 | `seat_taken`、`hold_exists`、`sold_out`、`not_on_sale`、`hold_expired`、`terminal_state`、`capacity_below_sold`、`capacity_exceeded`、`promo_rejected`、`email_taken` |

**理由**:spec 全部只寫 4xx,契約要定死才能寫契約測試;409 集中所有「規則說不行」的情況,測試一眼看得出是規則擋的還是輸入壞的。

**放棄**:410 給過期 hold(多一個碼沒有多一分資訊);422(Hono 沒特別支援,400 夠用)。

## R4. 金額引擎介面 **[作者手寫區,Day 25]**

**決定(只定介面與測試向量)**:`src/domain/money.js` 匯出

```
applyPct(cents: int, pct: int) → int         // floor((cents × (100 − pct) + 50) / 100)
quote({
  unit_price_cents: int, qty: int,           // 一個 hold 一個票種、N 座(spec Assumptions 的解讀)
  early_bird_pct: int,                       // 0 = 不符合早鳥;由 time-rules 判定後傳入
  group_min_qty: int, group_pct: int,
  promo_cents: int,                          // 0 = 沒帶碼
}) → { subtotal_cents, after_early_bird_cents, after_group_cents, promo_cents, total_cents }
```

全程整數;`total_cents` 下限 0(優惠碼大於小計時歸零,不為負)。測試向量:

| 輸入 | 期望 |
|---|---|
| 100000 × 1、早鳥 10、團體 10(qty ≥ min)、優惠 10000 | 71000 |
| 同上但先減後乘 | **不是** 72900 或 70000 —— 這兩個數字是反向探針 |
| 33333 × 3、早鳥 10、團體 0、優惠 0 | applyPct(99999, 10) = 89999(四捨五入:99999×90+50 = 8999960 → /100 = 89999) |
| 5000 × 1、優惠 6000 | 0 |

**放棄**:逐座套折扣再加總(C9 決定不逐座);浮點 `× 0.9`(規則 I)。

## R5. 時間表示與注入 **[時間判定屬作者手寫區,Day 26]**

**決定**:
- 系統內時間一律 **epoch 毫秒整數**(與現有 `server_now` / `x-server-now` 一致);OpenAPI 所有時間欄 `type: integer, format: int64`。schema 裡用 INTEGER 還是 TEXT 是 Day 22 的自由(`schema.test.js` ② 只要求一致),但 `lib/db` 進出一律轉成毫秒整數。
- 所有 domain 函式最後一個參數是 `now`;`lib/db` 的函式也吃 `now`(SQL 的 `expires_at <= ?` 用它);`routes` 從 `c.get('now')` 取;`scheduled()` 從 `Date.now()` 取一次傳進 `sweepExpired(db, now)`。
- `src/domain/time-rules.js` 介面:`canHold(event, now) → { ok, reason }`(檢查 `status === 'on_sale'` **且** `opens_at <= now < deadline_at`,兩個真相來源分開回 reason)、`isEarlyBird(ticketType, now)`、`isHoldExpired(hold, now)`、`holdExpiresAt(now, ttlMinutes)`。
- 測試用 `tests/helpers/clock.js`:`const clock = fakeClock(t0); clock.advance(ms)`,route 測試透過 `app.request(path, init, env)` 前先 `app.use` 覆寫 `now`?—— 不行,middleware 已固定。改為 `createApp({ now: () => clock.now })`,`app.js` 接受可注入的 `now` 工廠,預設 `Date.now`。**這會動 `app.js`,但 `Date.now` 仍只出現在 `app.js` / `worker.js`,裁判通過。**

**理由**:「剛好等於開賣 / 剛好等於逾時」的邊界只有可控的 `now` 才測得到;毫秒整數比 ISO 字串少一次 parse、比較不會因時區出錯。

## R6. 併發:D1 上「名額不足 → 整批失敗」的候選 **[作者手寫區,Day 27]**

**已驗證的平台事實**(`docs/spec.md` 2026-09-10 實跑):
1. `db.batch()` 是一個交易,**任一語句拋錯 → 整批回滾**。
2. `UPDATE … WHERE …` 命中 0 列**不是錯誤**,`changes = 0`,不回滾。
3. 裸 `INSERT` 撞 UNIQUE → 拋錯;`ON CONFLICT DO NOTHING` → 不拋、`changes = 0`。
4. 部分唯一索引述詞看 `status`,不看 `expires_at`;要先翻 status 才能重佔。

**候選(plan 不選,留給 Day 27)**:

| | 做法 | 與規則 III 的關係 | 代價 |
|---|---|---|---|
| (a) | batch:`UPDATE seat_holds SET status='expired' WHERE … expires_at <= ?` → `UPDATE ticket_types SET remaining = remaining − ? WHERE id = ? AND remaining >= ?` → N 個裸 `INSERT seat_holds` → (hold 表頭)。靠 `CHECK (remaining >= 0)` 讓名額不足時拋錯回滾 | `WHERE` 有守衛、檔案有看 `changes`(裁判過);但真正回滾的是 `CHECK`。**若守衛擋下(changes = 0)而 CHECK 沒觸發,INSERT 已 commit** —— 這種情況只在守衛與 CHECK 條件不一致時發生,把守衛寫成 `remaining >= ?` 且 CHECK 為 `>= 0` 就一致 | 最少語句;要在測試裡證明「守衛失敗 ⇔ CHECK 失敗」 |
| (b) | 兩段:先單獨 `UPDATE ticket_types … WHERE remaining >= ?`,看 `changes`;=1 才 batch 座位;座位失敗則補償 `UPDATE ticket_types SET remaining = remaining + ?` | 完全符合字面 | 兩段之間不原子;補償本身可能失敗;要多一組測試 |
| (c) | 名額改成座位級:票種綁座位區(例如 A 區 = VIP),名額 = 該區座位數,超賣自動由 UNIQUE 索引擋 | 名額判斷消失,只剩座位唯一 | **改變 C3 的語意**(票種名額變成推導值,主辦不能改),要回到 spec 重決定 |

**共同要求**:不論選哪個,`tests/concurrency.test.js` 要用 `runConcurrently(n, …)` 閘門重現 SC-001 / SC-002 / SC-004,CI 重跑 5 次;`race.sh` 打遠端 Worker 做真實多連線。

**Cron**:`wrangler.toml` 加 `[triggers] crons = ["*/5 * * * *"]`;`sweepExpired(db, now)` 一句 `UPDATE seat_holds SET status='expired' WHERE status='holding' AND expires_at <= ?`,回 `changes`,寫 `console.log` 給 `wrangler tail` 看(沒有 log 聚合)。每 5 分鐘是因為搶位路徑自己會翻過期,清掃只處理沒人搶的座位,不需要每分鐘。

## R7. 測試基礎設施

**決定**:
- D1 一律 `getPlatformProxy({ persist: false })`(`tests/helpers/db.js` 已有),每個測試檔一個 proxy,`beforeAll` 建 schema、`afterAll` dispose;不做跨檔共享。
- route 測試:`app.request(path, init, proxy.env)` 直接打 Hono,不起 wrangler dev。
- `tests/helpers/auth.js`:`register(app, env, {email, role})` + `login()` 回 `{ access, refresh }`;要 staff 時直接 `UPDATE members SET role='staff'`(角色只能 SQL 改,測試也一樣)。
- 契約測試:devDependencies 加 `yaml` + `ajv`(+ `ajv-formats`);讀 `openapi.yaml`,對每條 route 的實際回應驗 response schema;501 階段也要過(error schema)。
- 併發:`tests/helpers/gate.js` 已有;`concurrency.test.js` 在 `package.json` 已預留 `test:race`,CI 已預留重跑 5 次(`hashFiles` 觸發)。

**放棄**:`@hono/zod-openapi` 從 code 生契約(契約要先於 code commit,方向相反);`better-sqlite3` shim(不是 D1 的語意)。

## R8. OpenAPI 契約

**決定**:OpenAPI **3.1**,單檔 `openapi.yaml` 放 repo 根(`tests/contract.test.js` 與 iOS build phase 都讀它);`specs/001-event-signup-full/contracts/openapi.yaml` 是設計稿,實作第一個 task 就是把它搬到根並 commit(契約先行)。
`securitySchemes: bearerAuth`;所有金額 `integer`、所有時間 `integer/int64`(毫秒);`seat_no` pattern `^[A-J](10|[1-9])$`(10×10:列 A–J、欄 1–10)。

**放棄**:3.0(swift-openapi-generator 兩者都吃,3.1 的 `type: ["string","null"]` 寫 nullable 較乾淨)。

## R9. iOS 骨架

**決定**:SwiftPM 專案 `ios/EventSignup`,iOS 17+,SwiftUI;`swift-openapi-generator` 以 build plugin 從 `openapi.yaml` 產 `Client`,`swift-openapi-urlsession` 當 transport;
token 存 Keychain;bearer 由 `ClientMiddleware` 注入,401 → refresh 一次;
離線快取 = 最後一次 `GET /orders` 的原始 JSON 存 `Application Support/orders.json`,離線時讀它並顯示「離線資料」標籤;寫入操作(登出)離線時直接顯示需要連線。
QR 用 `CoreImage.CIFilter.qrCodeGenerator()` 畫 `qr_payload`。兩個畫面:登入、票券列表 → 明細。

**放棄**:手寫 `URLSession` client(C2 說從 OpenAPI 產生);SwiftData / CoreData 做快取(非目標 8 只要讀取快取,一個 JSON 檔就夠)。

## R10. 票券 QR 的 payload

**決定**:`qr_payload = "<order_id>.<base64url(HMAC-SHA256(order_id, QR_SECRET))[0:22]>"`(前 16 bytes,約 22 字元);
由 API 在 `GET /orders/:id` 與 `GET /orders` 每筆帶出,前端只負責畫成 QR(web 用 `qrcode` npm 套件,iOS 用 CoreImage)。
`QR_SECRET` 與 `JWT_SECRET` 分開(不同用途不同 key)。**不含 email / 暱稱 / 金額**(C21)。本專案不做查驗端(非目標 13);若日後做,用 `subtle.verify`。

**放棄**:把整張票 JSON 簽成 JWT 放 QR(QR 太密、含個資);只放 order_id 不簽(任何人都能偽造 QR)。

## R11. seed 資料

**決定**:`seed.sql` 建:1 個 staff(`staff@example.com` / `password123`)、1 個 member、1 個 `on_sale` 活動(`opens_at` = 昨天、`deadline_at` = 30 天後、`hold_ttl_minutes` = 10、團體 4 / 10)、2 個票種(一般 100000 分名額 60、VIP 200000 分名額 40、早鳥 10% 到 7 天後)、1 個全站優惠碼(`WELCOME` 10000 分)。
密碼雜湊用 `lib/password.js` 先算好貼進 SQL(seed 不跑 JS)。

## 對 constitution 的一個回饋

規則 V「另一半還沒有自動檢查」的註記(CLAUDE.md、constitution)已過時:`tests/schema.test.js` ⑥ 從 2026-09-10 起就會在 `order_items` 缺單價欄時變紅。建議下次 `/speckit-constitution` 時把那段改成「由 `tests/schema.test.js` ⑥ 裁判」。
