---

description: "Task list for 活動報名系統(完整功能)"
---

# Tasks: 活動報名系統(完整功能)

**Input**: `specs/001-event-signup-full/` 的 spec.md、plan.md、research.md、data-model.md、contracts/README.md、quickstart.md

**Prerequisites**: plan.md、spec.md(皆已完成)

**Tests**: 要寫。`CLAUDE.md`「寫測試」:先寫一個會紅的測試再動手;併發測試一律用 `tests/helpers/gate.js`;重跑 5 次結果一致。
spec SC-005 也要求原文十條規則都有測試證明。

**Organization**: 依 spec 的使用者故事分 phase。

## 讀這份清單前要知道的

- **`[x]` 的判斷依據**:`git log` 裡有對應 commit、且 `src/` / `tests/` 裡看得到該檔案與行為(已在 `/speckit-clarify` 查核過)。
  不確定的一律 `[ ]`,並在描述寫「可能已完成,請確認」。
- **T 編號是這次重新產生的**,與 commit 訊息裡的 `T0xx`(舊的 tasks.md)**不是同一套編號**。對照請看每列後面的 commit。
- **日期**:已完成的寫**實際 commit 日期**(`✅ MM-DD sha`);未完成的寫**建議日期**(`📅 MM-DD`)。
  - 約束:9/14 開工、10/13 結束、一人全端、每天約半天、每天還要發一篇文章 → 每天排 2–4 個小 task(約 3 小時),週末照排但較輕。
  - **實際情況與原排程差很多**:`git log` 顯示 9/14 之後到 9/26 只有 spec-kit 產物與 devlog;**實作幾乎全部集中在 09-27 一天的 commit**。
    所以 9/14–9/26 在總表上是「規格與實驗」,不是「實作」。剩下 16 天(9/28–10/13)排的是補測試、待作者決定的項目、端到端驗證與收尾。
- **【待作者確認】** 的 task 要作者先拍板,才能進它後面的實作 task。
- 測試現況以 commit `ec550fa` 的紀錄為準(228/228 綠、check:all 與 self-test 過、swift build 過);本次沒有重跑。

## Format: `[ID] [P?] [Story] Description`

- **[P]**:可平行(不同檔案、不依賴未完成的 task)
- **[Story]**:US1–US6,對應 spec.md

---

## Phase 1: Setup(專案骨架)

**Purpose**:裁判、骨架、契約、三端腳手架。全部已完成。

- [x] T001 靜態檢查五支與自我測試、併發閘門、CI:`scripts/check-*.sh`、`scripts/self-test.sh`、`tests/helpers/gate.js`、`.github/workflows/ci.yml` —— ✅ 09-04 `c24ccbb`(之後 09-09 ~ 09-10 多次補漏:`9a40637`、`53b7043`、`7e79f2e`、`72d7f12`)
- [x] T002 Worker + Hono 骨架與 `GET /health`:`src/worker.js`、`src/app.js`、`src/routes/*.js` —— ✅ 09-10 `f946e55`
- [x] T003 契約先行:根目錄 `openapi.yaml`(18 條 operation)—— ✅ 09-27 `238ea84`;operationId ✅ `a0aa547`;YAML 逗號修正 ✅ `248d7aa`
- [x] T004 [P] `wrangler.toml`(D1 binding、`crons = ["*/5 * * * *"]`、`CORS_ORIGIN`)與 `.dev.vars.example` —— ✅ 09-27 `3119ab4`;真的 D1 id ✅ `d562473`
- [x] T005 [P] 時鐘注入 `createApp({ now })` 與 `tests/helpers/clock.js` —— ✅ 09-27 `97152f9`
- [x] T006 契約測試 `tests/contract.test.js`(ajv 2020 驗每條 operation 的 status 與 body)—— ✅ 09-27 `a1b34aa`
- [x] T007 [P] web 腳手架 `web/`(Vite + Tailwind v4 + daisyUI v5)—— ✅ 09-27 `c618291`
- [x] T008 [P] iOS 骨架 `ios/EventSignup/Package.swift`(swift-openapi-generator build plugin)與 `scripts/sync-openapi.sh` —— ✅ 09-27 `20bfe4b`;app 殼 `ios/App/` ✅ `1dcd3de`

---

## Phase 2: Foundational(所有故事的前置)

**Purpose**:schema、domain 純函式、認證底層、測試基礎設施。全部已完成。

- [x] T009 `schema.sql`:8 表、`STRICT`、`*_cents`、epoch 毫秒、`ux_seat_active … WHERE status IN ('holding','confirmed')`、`ux_member_holding`、`ux_orders_member_event_promo` —— ✅ 09-27 `edb480d`;`tests/schema.test.js` 與 `tests/helpers/sql.js` 切句修正 ✅ `ff461df`、`d6ae934`
- [x] T010 [P] `seed.sql`(staff / member、秋季音樂會、一般 100000 分 × 60、VIP 200000 分 × 40)—— ✅ 09-27 `ebfc91f`
- [x] T011 [P] `src/domain/validate.js` 與 `src/domain/states.js`(活動無 `cancelled`、三個終態)+ `tests/domain/` —— ✅ 09-27 `ccb8bdd` → `23d2901`
- [x] T012 [P] `src/domain/time-rules.js`(`canHold`、`isEarlyBird`、`isHoldExpired`)15 個邊界測試 —— ✅ 09-27 `04a9475` → `30b0228`
- [x] T013 [P] `src/lib/password.js`(PBKDF2-SHA256 100,000 次、常數時間比對)—— ✅ 09-27 `425489a` → `d4bd5e1`
- [x] T014 `src/lib/jwt.js`(HS256、只用 `crypto.subtle.verify`)、`src/lib/db/members.js`、`src/lib/db/refresh-tokens.js`、`src/routes/_auth.js` —— ✅ 09-27 `4c0b388`
- [x] T015 [P] `tests/jwt.test.js` 六個邊界測試(規則 IV 裁判之一)—— ✅ 09-27 `c67c7d1`
- [x] T016 [P] 測試 helper `tests/helpers/auth.js`、`tests/helpers/world.js` —— ✅ 09-27 `bb7a9ae`
- [x] T017 [P] `src/lib/hmac.js` 票券 QR 簽章(只簽不驗)—— ✅ 09-27 `0022006`;`verifyQrPayload` 刪除 ✅ `ec550fa`
- [x] T018 [P] `src/presentation/money.js`(`centsToDisplay`,API 側唯一可 `/100`)—— ✅ 09-27 `deadda3`

**Checkpoint**:基礎完成,各故事可開始。

---

## Phase 3: User Story 1 — 選位、保留並確認(Priority: P1)🎯 MVP

**Goal**:成員在開賣時段選 1–10 席 + 一個票種取得保留,到期前確認成訂單;不超賣、不重座、到期那一刻原持有人輸。

**Independent Test**:`npm run test:race` + `tests/routes/holds.test.js`;SC-001、SC-002、SC-003。

### 已完成

- [x] T019 [US1] 先紅:保留與確認路由測試與併發測試(兩個真相來源分開、`hold_exists`、非本人 404、過期、放棄、截止後仍可確認;SC-001/002)`tests/routes/holds.test.js`、`tests/concurrency.test.js` —— ✅ 09-27 `da35d3c`、`1afefa3`
- [x] T020 [US1] `src/lib/db/holds.js`:一個 batch —— 還過期名額 → 翻過期 → 裸 INSERT → 扣名額(`CHECK (remaining >= 0)`)—— ✅ 09-27 `eb5bf59`
- [x] T021 [US1] 保留 / 放棄 / 確認路由 `src/routes/events.js`(`POST /events/:id/holds`)、`src/routes/holds.js`;`src/lib/db/orders.js` `insertConfirmed` —— ✅ 09-27 `6286238`、`73818c3`
- [x] T022 [US1] 併發補測:座位衝突與名額不足同時 → `seat_taken` `tests/concurrency.test.js` —— ✅ 09-27 `0f97a44`
- [x] T023 [US1] SC-003 三方競態、`sweepExpired` 與 Cron 測試 `tests/concurrency.test.js`、`tests/worker.test.js` —— ✅ 09-27 `906cc4c`
- [x] T024 [US1] H7 併發:兩個 confirm 同時到只成立一張(`INSERT orders … WHERE changes() = n`)`src/lib/db/orders.js` —— ✅ 09-27 `06f8fd2`

### 待做:補測試(行為已實作,沒有測試釘住)

- [ ] T025 [P] [US1] 先寫測試:對已過期 / 已確認 / 已放棄的保留 `DELETE /holds/:id` → 409 `terminal_state`,於 `tests/routes/holds.test.js` —— 📅 09-28
- [ ] T026 [P] [US1] 先寫測試:已確認的保留再 confirm,body 帶**不同**優惠碼、以及時鐘推過 `expires_at` 之後 → 都回 200 同一張訂單;訂單取消後再 confirm → 409 `terminal_state`,於 `tests/routes/holds.test.js` —— 📅 09-28
- [ ] T027 [P] [US1] 先寫測試:`ticket_type_id` 屬於別的活動 → 404 `not_found`,於 `tests/routes/holds.test.js` —— 📅 09-28
- [ ] T028 [P] [US1] 先寫測試:`status='holding'` 但 `expires_at <= now`(尚未被翻)的座位,`GET /events/:id` 顯示 `free`、`remaining_seats` 不扣它;`now == expires_at` 那一刻也算 `free`,於 `tests/routes/events.test.js` —— 📅 09-29
- [ ] T029 [P] [US1] 先寫測試:放棄與取消訂單後,`seat_holds` 的列仍在、只改 `status`(`cancelled`),於 `tests/routes/holds.test.js`、`tests/routes/orders.test.js` —— 📅 09-29

### 待做:契約與決定

- [ ] T030 [US1] 契約修正:`openapi.yaml` 的 `POST /events/{id}/holds` `seat_nos` 由 `maxItems: 100` 改為 `maxItems: 10`(spec FR-041、H1);`sh scripts/sync-openapi.sh`;`npm run test:contract` 與 `swift build` 都要過 —— 📅 09-29
- [ ] T031 [US1] 【待作者確認】Q26:座位狀態 `mine` 是否包含自己**已確認**的座位(spec 答案:只算保留中;現況:含已確認)。作者在 `spec.md` Q26 下寫定案 —— 📅 09-28(作者)
- [ ] T032 [US1] 依 T031 定案:若「只算保留中」,先寫會紅的測試於 `tests/routes/events.test.js`(自己已確認的座位應為 `sold`),再改 `src/lib/db/events.js` `seatMap` 的判斷為 `s.status === 'holding' && s.member_id === viewerId ? 'mine' : …`;若維持現況,改 `spec.md` FR-025 與 `openapi.yaml` `Seat.state` 描述 —— 📅 10-03

**Checkpoint**:US1 所有行為都有測試釘住,契約與程式一致。

---

## Phase 4: User Story 2 — 帳號(Priority: P1)

**Goal**:註冊、登入、續期輪替、重放撤銷全部、登出、失敗鎖定。

**Independent Test**:`tests/routes/auth.test.js`、`tests/routes/login-lockout.test.js`、`npm run test:jwt`。

### 已完成

- [x] T033 [US2] 註冊、登入、refresh 輪替(重放 → 撤該成員全部,401 `refresh_replayed`)、登出;`src/routes/auth.js` —— ✅ 09-27 `784f2d1`
- [x] T034 [US2] 登入失敗鎖定:`members.failed_logins` / `locked_until`、5 → 10 → 20 → 40 → 60 分鐘;`src/lib/db/members.js`、`tests/routes/login-lockout.test.js` —— ✅ 09-27 `7c69d92` → `9d6f65b`
- [x] T035 [US2] refresh 與 logout 路由測試;logout 不帶 `refresh_token` → 400 `tests/routes/auth.test.js` —— ✅ 09-27 `910d4f0` → `990a3bc`

### 待做:補測試

- [ ] T036 [P] [US2] 先寫測試:重複 email → 409 `email_taken`;`A@x.com` 已註冊時註冊 `a@x.com` 也是 409(「一律轉小寫存,唯一不分大小寫」),於 `tests/routes/auth.test.js` —— 📅 09-30
- [ ] T037 [P] [US2] 先寫測試:時鐘推 10 天後輪替,新 refresh 在「輪替時間 + 30 天 − 1 ms」仍可用、「+ 30 天」失效,於 `tests/routes/auth.test.js` —— 📅 09-30
- [ ] T038 [P] [US2] 先寫測試:登出後,原 access token 在 15 分鐘內打 `GET /orders` 仍 200、滿 15 分鐘 401,於 `tests/routes/auth.test.js` —— 📅 09-30

**Checkpoint**:US2 clarify 答案(Q16、Q17、Q19)都有測試。

---

## Phase 5: User Story 3 — 主辦管理活動與票種(Priority: P2)

**Goal**:staff 建活動;主辦改名額(全有全無)、改時間、改價、提前截止;越權 403。

**Independent Test**:`tests/routes/events.test.js`、`tests/routes/ticket-types.test.js`;SC-006。

### 已完成

- [x] T039 [US3] 先紅:活動 10 個與票種 5 個路由測試 —— ✅ 09-27 `bb7a9ae`
- [x] T040 [US3] 活動 5 條 + 票種 2 條路由、`requireOwner`、draft 只給主辦;`src/routes/events.js`、`src/routes/ticket-types.js`、`src/lib/db/events.js`、`src/lib/db/ticket-types.js` —— ✅ 09-27 `e4d2ebd`
- [x] T041 [US3] `PATCH /events/:id` 改名額全有全無(同一 batch)—— ✅ 09-27 `906cc4c` → `06f8fd2`
- [x] T042 [US3] 名額總和 > 100 的第二道:`schema.sql` 兩個 trigger `RAISE(ABORT, 'capacity_exceeded')`;併發 PATCH + POST 測試 —— ✅ 09-27 `e03185d` → `ec550fa`

### 待做:補測試

- [ ] T043 [P] [US3] 先寫測試:`PATCH /events/:id` 帶 `ticket_types` 使總和 > 100 → 409 且 `error = 'capacity_exceeded'`(目前只測了 status),於 `tests/routes/events.test.js` —— 📅 10-01
- [ ] T044 [P] [US3] 先寫測試:新增票種 `capacity: 101` → 400 `invalid_input`(「名額 0–100」),於 `tests/routes/ticket-types.test.js` —— 📅 10-01
- [ ] T045 [P] [US3] 先寫測試:對 `closed` 活動新增票種仍 201(「任何狀態都可新增,只受總和 ≤ 100」),於 `tests/routes/ticket-types.test.js` —— 📅 10-01
- [ ] T046 [P] [US3] 先寫測試:對 `finished`(以 SQL 設定)活動 `POST /events/:id/close` → 409 `terminal_state`,於 `tests/routes/events.test.js` —— 📅 10-01
- [ ] T047 [P] [US3] 先寫測試:對 `closed` 活動 `PATCH` 把 `deadline_at` 改到未來,`status` 仍是 `closed`、`POST /holds` 仍 409 `not_on_sale`,於 `tests/routes/events.test.js` —— 📅 10-02
- [ ] T048 [P] [US3] 先寫測試:`POST /events` 的 `opens_at`、`deadline_at` 都在過去(`opens_at < deadline_at`)→ 201,於 `tests/routes/events.test.js` —— 📅 10-02
- [ ] T049 [P] [US3] 先寫測試:`GET /events?status=bogus` → 400;預設列表含 `closed` 與 `finished`;`?status=on_sale` 仍列出已過 `deadline_at` 但 `status='on_sale'` 的活動,於 `tests/routes/events.test.js` —— 📅 10-02

### 待做:決定

- [ ] T050 [US3] 【待作者確認】Q24:截止後是否由排程轉 `finished`。作者在 `spec.md` Q24 寫定案 —— 📅 09-28(作者)
- [ ] T051 [US3] 依 T050 定案:若要排程,先寫會紅的測試於 `tests/worker.test.js`(條件由作者定),再在 `src/worker.js` `scheduled` 與 `src/lib/db/events.js` 加條件式 `UPDATE events SET status = 'finished' WHERE status = 'closed' AND …` 並看 `changes`;若不要,改 `spec-writeback.md` 的建議為「只由 SQL」—— 📅 10-04
- [ ] T052 [US3] 【待作者確認】plan C-1:`GET /health` 算不算第 19 條 endpoint;作者決定保留(在 spec FR-001 註明探針不計)或移除(`src/app.js`、`openapi.yaml`、`tests/contract.test.js` 一起改)—— 📅 09-28(作者),實作 📅 10-04

**Checkpoint**:US3 clarify 答案(Q13、Q14、Q22、Q25、Q27、Q29、Q30)都有測試。

---

## Phase 6: User Story 4 — 折扣擇優與試算(Priority: P2)

**Goal**:三種折扣只套一種、平手 優惠碼 → 早鳥 → 團體;無效碼規則;試算不建單不用碼。

**Independent Test**:`tests/domain/money.test.js`、`tests/routes/holds.test.js`(優惠碼)、`tests/routes/quote.test.js`;SC-004。

### 已完成

- [x] T053 [US4] 金額引擎擇優 `src/domain/money.js`(`applyPct` 整數四捨五入、嚴格 `<`)+ `tests/domain/money.test.js` —— ✅ 09-27 `9203e09` → `ba123f0`
- [x] T054 [US4] 無效碼只在「嚴格更便宜」或「沒有別的折扣」時 409(C8 改定)`src/routes/holds.js` `price()` —— ✅ 09-27 `1571e10` → `58c9ac9`
- [x] T055 [US4] 試算 `POST /holds/:id/quote`(`promo_status`:`none` / `applied` / `not_better` / `invalid`)+ `tests/routes/quote.test.js` —— ✅ 09-27 `f544ca2` → `04666ae`

### 待做

- [ ] T056 [US4] 【待作者確認】Q11:0 元票種 + 「存在但無效」的碼 → 409(spec 答案)還是忽略、201(現況)。作者在 `spec.md` Q11 寫定案 —— 📅 09-28(作者)
- [ ] T057 [US4] 依 T056 定案:先寫會紅的路由測試(0 元票種 × 有效碼 → 201 且 `promo_code` 為 NULL、`promo_status = 'not_better'`;0 元票種 × 過期碼 → 依定案)於 `tests/routes/holds.test.js`;若定案為 409,改 `src/routes/holds.js` `price()` 的 `blocks`,讓「沒有別的折扣(`q0.applied === null`)」對存在的碼也成立 —— 📅 10-05
- [ ] T058 [P] [US4] 先寫測試:優惠碼 `valid_until == now` 那一刻視為失效(「`now < valid_until` 才有效,相等即失效」),於 `tests/routes/holds.test.js` —— 📅 10-05
- [ ] T059 [P] [US4] 先寫測試:試算對過期保留回 409 且 `error = 'hold_expired'`、對已放棄 / 已確認回 409 且 `error = 'terminal_state'`(目前只斷言 status),於 `tests/routes/quote.test.js` —— 📅 10-05
- [ ] T060 [P] [US4] 先寫測試:保留建立時碼有效、試算時已過 `valid_until` → `promo_status = 'invalid'`(試算用試算當下時間),於 `tests/routes/quote.test.js` —— 📅 10-06

**Checkpoint**:US4 clarify 答案(Q9–Q12、Q32、Q33)都有測試。

---

## Phase 7: User Story 5 — 我的票券、明細與取消(Priority: P3)

**Goal**:本人所有訂單列表、明細含快照與 QR、取消已確認訂單釋放座位。

**Independent Test**:`tests/routes/orders.test.js`;SC-007、SC-009。

### 已完成

- [x] T061 [US5] `GET /orders`、`GET /orders/:id`(本人或主辦)、`POST /orders/:id/cancel`;`src/routes/orders.js`、`src/lib/db/orders.js`、`src/presentation/orders.js` + 路由測試 —— ✅ 09-27 `1afefa3`、`6286238`、`73818c3`

### 待做

- [ ] T062 [P] [US5] 先寫測試:`GET /orders` 包含本人 `cancelled` 與 `checked_in`(以 SQL 設定)訂單、不含保留,依 `confirmed_at` 新到舊,於 `tests/routes/orders.test.js` —— 📅 10-06
- [ ] T063 [P] [US5] 先寫測試:已取消訂單的 `GET /orders/:id` 仍含 `qr_payload`,於 `tests/routes/orders.test.js` —— 📅 10-06
- [ ] T064 [P] [US5] 先寫測試:活動 `closed` 後、以及時鐘推過 `deadline_at` 後,取消 `confirmed` 訂單仍 200,於 `tests/routes/orders.test.js` —— 📅 10-07
- [ ] T065 [US5] SC-009:新增 `scripts/rows-read.sh`,對本機 D1(`npm run dev` + `seed.sql`)登入後打一次 `GET /orders`,記下 D1 回應 `meta.rows_read` 的加總;把數字、環境與日期寫進 `devlog/rows-read.md`(沒有目標值)—— 📅 10-07

**Checkpoint**:US5 clarify 答案(Q15、Q34、Q35、Q44)都有測試或紀錄。

---

## Phase 8: User Story 6 — web 與 iOS(Priority: P3)

**Goal**:web 五畫面、iOS 三畫面,兩端對同一筆資料顯示相同。

**Independent Test**:quickstart §3、§4 手動走一次;SC-008。

### 已完成

- [x] T066 [US6] web 五畫面:登入/註冊、活動列表、10×10 選位、保留倒數與確認、我的票券含 QR;`web/src/pages/*.js`、`web/src/api.js` —— ✅ 09-27 `c618291`
- [x] T067 [US6] `check-money.sh` 擴掃 `web/src`(排除 `web/src/lib/money.js`)—— ✅ 09-27 `7e307ee`
- [x] T068 [US6] web 保留頁改版:進頁試算、「套用」按鈕、錯誤代碼翻中文 `web/src/pages/hold.js` —— ✅ 09-27 `7dd0817`;票券頁只顯示實際套用的折扣 ✅ `72b7639`
- [x] T069 [US6] web 上 Cloudflare Pages(event-signup-web.pages.dev)—— ✅ 09-27 `aa2185e`
- [x] T070 [US6] iOS 三畫面:登入(refresh 存 Keychain、401 自動 refresh 一次)、活動列表 → 明細唯讀座位圖、票券列表與明細 + 離線快取;`ios/EventSignup/Sources/EventSignup/` —— ✅ 09-27 `c7cfe38`
- [x] T071 [US6] `check-money.sh` 擴掃 iOS(排除 `Tickets/Money.swift`)—— ✅ 09-27 `0492e65`

### 待做

- [ ] T072 [P] [US6] 先寫測試:`web/src/lib/money.js` `formatCents` —— `12345 → 'NT$123.45'`、`100000 → 'NT$1,000'`、`0 → 'NT$0'`、`5 → 'NT$0.05'`,於 `tests/web/money.test.js`(`vitest.config.js` 的 include 已涵蓋 `tests/**`)—— 📅 10-08
- [ ] T073 [US6] iOS 千分位固定為逗號(Q39「NT$1,000」;plan G1-a):`ios/EventSignup/Sources/EventSignup/Tickets/Money.swift` 的 `NumberFormatter` 設 `locale = Locale(identifier: "en_US_POSIX")` 與 `groupingSeparator = ","`,或改成與 web 相同的整數取餘數拼字串;不得引入 `Double`;`npm run check:money` 與 `swift build` 要過 —— 📅 10-08
- [ ] T074 [US6] 部署確認:Worker 與遠端 D1 schema 是否已上線(`wrangler deploy`、`wrangler d1 execute signup --remote --file=./schema.sql`)。**可能已完成(`7dd0817` 提到線上實測),請確認後打勾** —— 📅 10-09
- [ ] T075 [US6] web 端到端(quickstart §3):登入 → 選 2 席 → 倒數 → 套用碼 → 確認 → 票券 QR → 取消 → 座位變空;另測放棄按鈕。結果記在 `devlog/e2e-web.md` —— 📅 10-09
- [ ] T076 [US6] iOS 端到端(quickstart §4):登入、活動列表 → 明細座位圖、票券列表與明細、關網路後仍能讀票券快取。結果記在 `devlog/e2e-ios.md` —— 📅 10-10
- [ ] T077 [US6] SC-008:同一成員同一張訂單,比對 web 與 iOS 顯示的金額、座位、狀態、QR 字串;不一致逐項記在 `devlog/e2e-ios.md` —— 📅 10-10

**Checkpoint**:兩端都在真資料上跑過一次。

---

## Phase 9: Polish & Cross-Cutting

- [ ] T078 [P] 先寫測試:`openapi.yaml` 與 `ios/EventSignup/Sources/EventSignup/openapi.yaml` 內容逐位元相同(plan C-2;防兩份分岔),於 `tests/contract.test.js` —— 📅 09-29
- [ ] T079 作者把 `spec-writeback.md` 各節回寫進 `docs/spec.md`(Q9 矛盾優先;作者自己動手)—— 📅 10-11(作者)
- [ ] T080 作者決定規則字面的張力:plan G3-a(扣名額靠 `CHECK` 而非 `WHERE`)、G3-b(改名額先查再寫 + trigger)、G4-a(常數時間 vs `crypto.subtle.verify`)、G2-a(時間取點在 `src/app.js`);要改的改 `CLAUDE.md`,再重跑 `/speckit-constitution` —— 📅 10-11(作者)
- [ ] T081 全面驗證:`npm run check:all`、`sh scripts/self-test.sh`、`npm test`、`npm run test:race` 連跑 5 次結果一致、`cd ios/EventSignup && swift build`;結果貼進 `devlog/` 當天紀錄 —— 📅 10-12
- [ ] T082 `/speckit-analyze` 跨 spec / plan / tasks 一致性檢查,處理抓到的問題 —— 📅 10-12
- [ ] T083 收尾:更新 `specs/001-event-signup-full/checklists/requirements.md` 的 Notes(clarify 後仍寫著 42 處未答)、`plan.md` 的「現況與 spec 的落差」表逐列結案 —— 📅 10-13

---

## 系列實驗(非 spec 範圍;依 `docs/EXPERIMENT-PROTOCOL.md`,照 git log 記錄)

- [x] T084 [P] Day 22 schema AI 版(乾淨 session,原文)`devlog/raw/` —— ✅ 09-27 `b1f7ed0`
- [x] T085 [P] Day 24 JWT AI 版(同一份 jwt.test 4/6)—— ✅ 09-27 `36ccdfd`
- [x] T086 [P] Day 25 金額引擎 AI 版,擇優改定後重量 —— ✅ 09-27 `6c6f54b`、`dc08708`
- [x] T087 [P] Day 26 時間判定 AI 版(14/15、check:time ❌)—— ✅ 09-27 `07a804b`
- [x] T088 [P] Day 27 併發 `holds.js` AI 版(31 個測試 × 5 全綠)—— ✅ 09-27 `0e768e6`

---

## Dependencies & Execution Order

### Phase 依賴

- Setup(Phase 1)、Foundational(Phase 2):已完成
- US1–US6(Phase 3–8):剩下的全是補測試與決定,彼此獨立,可任意順序
- Polish(Phase 9):T079、T080 需要前面的【待作者確認】都定案;T081–T083 最後

### 必須的先後

- T031 → T032;T050 → T051;T052 的實作在決定之後;T056 → T057
- T030(改契約)→ T078(兩份契約一致的測試)可同日做,T030 先
- T074(部署確認)→ T075、T076 → T077
- 所有「先寫測試」task:若測試一寫就綠(行為本來就對),照樣 commit,訊息寫明「補測試,行為已存在」

### 可平行

- 同一天標 `[P]` 的測試 task 各寫在不同 `describe`,可一次寫完再一起跑
- 作者的四個決定(T031、T050、T052、T056)同一天(09-28)一起做

### 範例:US1 的 9/28

```text
T025 DELETE 非 holding → terminal_state
T026 重複確認三種情況
T027 票種屬於別的活動 → 404
(三個都在 tests/routes/holds.test.js,不同 describe)
```

---

## Implementation Strategy

- **MVP = US1**(已上線的核心):剩下 T025–T032 是把它的行為全部釘住。
- 每天的節奏:上午寫 2–4 個 task(先紅 → 綠 → commit),下午寫當天文章;文章素材優先取當天的紅燈與決定。
- 【待作者確認】集中在 09-28 一次決定,後面的實作排在 10-03 ~ 10-05,給作者一週緩衝。
- 10-12、10-13 不排新功能,只做驗證與收尾;若前面延誤,T083 可以縮成只改 checklist。

---

## 日期 × 里程碑

| 日期 | 星期 | 實際 / 計畫 | 內容 | 里程碑 |
|---|---|---|---|---|
| 09-04 ~ 09-11 | — | 實際(開工前) | 靜態檢查、閘門、CI、骨架(`/health` + 17 條 501)、規格決定、前置實驗 | 裁判先於程式 |
| 09-14 | 一 | 實際 | spec-kit 腳手架、constitution、spec/plan/tasks 第一版、實驗紀律加 JWT | **開工** |
| 09-15 ~ 09-16 | 二–三 | 實際 | devlog(Day 3、Day 4 更正) | — |
| 09-17 ~ 09-26 | 四–六 | 實際 | git log 沒有 commit | ⚠️ 空白十天 |
| 09-27 | 日 | 實際 | 契約、schema、domain、認證、18 條路由、web 五畫面、iOS 三畫面、五個 AI 版實驗、Pages 上線、trigger;紀錄 228/228 綠 | **全部 18 條實作完成** |
| 09-28 | 一 | 計畫 | T025–T027;作者決定 T031、T050、T052、T056 | 四個【待作者確認】定案 |
| 09-29 | 二 | 計畫 | T028–T030、T078 | 契約 `maxItems` 修正、兩份契約一致 |
| 09-30 | 三 | 計畫 | T036–T038 | US2 測試補齊 |
| 10-01 | 四 | 計畫 | T043–T046 | — |
| 10-02 | 五 | 計畫 | T047–T049 | US3 測試補齊 |
| 10-03 | 六 | 計畫 | T032 | Q26 結案 |
| 10-04 | 日 | 計畫 | T051、T052 實作 | Q24、`/health` 結案 |
| 10-05 | 一 | 計畫 | T057–T059 | Q11 結案 |
| 10-06 | 二 | 計畫 | T060、T062、T063 | US4 測試補齊 |
| 10-07 | 三 | 計畫 | T064、T065 | US5 補齊、**SC-009 有數字** |
| 10-08 | 四 | 計畫 | T072、T073 | 兩端金額格式一致 |
| 10-09 | 五 | 計畫 | T074、T075 | web 端到端 |
| 10-10 | 六 | 計畫 | T076、T077 | iOS 端到端、**SC-008 比對** |
| 10-11 | 日 | 計畫 | T079、T080(作者) | 原文與規則回寫 |
| 10-12 | 一 | 計畫 | T081、T082 | 全綠 × 5、analyze 乾淨 |
| 10-13 | 二 | 計畫 | T083 | **結束** |
