# Tasks: 活動報名系統(完整功能)

**Input**: Design documents from `/specs/001-event-signup-full/`

**Prerequisites**: plan.md、spec.md、research.md、data-model.md、contracts/openapi.yaml、quickstart.md

**Tests**: 本專案 CLAUDE.md 規定「先寫一個會紅的測試,再動手」,所以每個 story 都有測試 task,而且排在實作前。

**Organization**: 依 user story 分 phase(P1 → P5)。但**執行順序由 `docs/EXPERIMENT-PROTOCOL.md` 與相依關係決定**,
不等於 phase 順序 —— 看每個 task 的 📅 與文末「日期 × 里程碑」總表。

## Format: `[ID] [P?] [Story] 📅日期 Description`

- **[P]**: 可與同 phase 其他 [P] 並行(不同檔、無未完成相依)
- **[Story]**: US1–US5,對應 spec.md
- **📅**: 建議日期(9/14 開工、10/13 結束、一人全端、每天一篇文 —— 所以每天只排半天工程量)
- **🖐 作者手寫,AI 不得先出版本**:`docs/EXPERIMENT-PROTOCOL.md` 的實驗對象(2026-09-14 起含 JWT,第五個)。順序:作者 commit(message 寫「AI 尚未介入」)→ 開乾淨 session 出 AI 版 → 另外 commit + 原文存 `devlog/raw/` → 比對。**本 session 看過考題,不能扮演那個乾淨 session。**
- ⚠️1(規則 III vs D1 batch)三個候選**不選**,全部留給 T030 的手寫實驗。

## Path Conventions

repo 根:`src/`(API)、`tests/`、`scripts/`、`web/`(Pages)、`ios/EventSignup/`(SwiftUI)、`openapi.yaml`、`schema.sql`、`seed.sql`。

---

## Phase 1: Setup(9/14–9/15)

**Purpose**: 回寫規格、契約先行、測試基礎設施補齊。全部是本 session 可做的(除了 T001 是作者)。

- [x] T001 📅9/14 🖐 作者回寫 `docs/spec.md`:依 `specs/001-event-signup-full/spec-writeback.md` 十一節逐條回寫(規格層決定表 7 → 14 列、活動狀態機拿掉 `cancelled`、折扣節補 C6–C10、前端新節);commit message 寫明「作者決定」
- [x] T002 📅9/15 把 `specs/001-event-signup-full/contracts/openapi.yaml` 複製到 repo 根 `openapi.yaml`,單獨一個 commit(契約先行的證據,要早於任何回 200 的 handler)
- [x] T003 [P] 📅9/15 新增 `.dev.vars.example`(`JWT_SECRET=`、`QR_SECRET=`、`CORS_ORIGIN=http://localhost:5173`),`.gitignore` 已排除 `.dev.vars`;`wrangler.toml` 補 `[triggers] crons = ["*/5 * * * *"]` 與 `[vars] CORS_ORIGIN`
- [x] T004 [P] 📅9/15 `package.json` devDependencies 加 `yaml`、`ajv`、`ajv-formats`;寫 `tests/contract.test.js`:讀 `openapi.yaml`,對 18 條 operation 各打一次 `app.request()`,驗回應 status 在契約列出的 codes 內、body 符合對應 schema —— **501 階段也要綠**(`not_implemented` 在 `Error.error` enum 裡)
- [x] T005 [P] 📅9/15 `src/app.js` 改成 `createApp({ now = Date.now } = {})`,middleware 用 `c.set('now', now())`;新增 `tests/helpers/clock.js`(`fakeClock(t0)` 提供 `now`、`advance(ms)`、`set(t)`);`tests/app.test.js` 改用 `createApp()` 預設值,確認 `npm run check:time` 仍綠(`Date.now` 只在 `app.js`、`worker.js`)
- [x] T006 [P] 📅9/15 `CLAUDE.md` 目錄表補 `src/lib/`(JWT、HMAC、密碼、`db/` SQL 存取;有 I/O 所以不進 domain)—— 不補等於偷加目錄

---

## Phase 2: Foundational(9/16–9/20)

**Purpose**: schema(實驗一)、密碼 / JWT / 身分 middleware、輸入驗證、狀態表、測試 helper。沒有這些任何 story 都動不了。

**⚠️ CRITICAL**: T007 是整個 protocol 的第一個實驗,順序不可逆:作者先、AI 後。

- [ ] T007 📅9/16 🖐 **作者手寫 `schema.sql`,AI 不得先出版本**。約束來自 `data-model.md`:8 張表白名單、STRICT、金額欄 `*_cents` INTEGER、時間欄型別一致、每個 status 有 CHECK 且列舉不多不少(活動:draft/on_sale/closed/finished;hold:holding/confirmed/expired/cancelled;訂單:confirmed/checked_in/cancelled;角色:member/staff)、`CHECK (remaining >= 0)`、部分唯一索引 `(event_id, seat_no) WHERE status IN ('holding','confirmed')`、`(member_id, event_id) WHERE status='holding'` 唯一、`order_items` 有 `unit_price_cents`、hold 表頭不帶金額欄。驗收:`npm run test:schema` 8/8、`/check-schema` 8/8。commit message「AI 尚未介入」
- [ ] T008 📅9/17 🖐 開乾淨 session(不給 CLAUDE.md / 本 specs / EXPERIMENT-PROTOCOL)出 AI 版 schema → 存 `devlog/raw/exp-01-schema/`(prompt 逐字、輸出原文)→ `SCHEMA=devlog/raw/exp-01-schema/schema.sql npm run test:schema` → 差異寫進 devlog;另外 commit
- [ ] T009 [P] 📅9/17 寫 `seed.sql`(R11):staff `staff@example.com` / member `member@example.com`(密碼 `password123`,雜湊由 T010 的 `lib/password.js` 先算好貼上)、1 個 `on_sale` 活動(`hold_ttl_minutes` 10、團體 4/10)、票種「一般」100000 分 × 60、「VIP」200000 分 × 40(早鳥 10%、7 天)、全站優惠碼 `WELCOME` 10000 分;`npm run db:init && npm run db:seed` 可重跑
- [x] T010 [P] 📅9/18 先寫 `tests/lib/password.test.js`(雜湊格式 `pbkdf2$100000$<salt>$<hash>`、同密碼不同 salt、錯密碼 false)→ 實作 `src/lib/password.js`:`hash(pw)`、`verify(pw, stored)` 用 `crypto.subtle.deriveBits` PBKDF2-SHA256 100,000 次,比對用 `crypto.subtle.timingSafeEqual`
- [x] T011 📅9/18 ~~🖐~~ **(2026-09-27 改:寫作 session 起草、作者審)** **JWT 是第五個實驗(2026-09-14 加入 EXPERIMENT-PROTOCOL)**。作者手寫 `tests/jwt.test.js`:六個分開的 `it`(過期 / 簽章竄改 / alg none 或換演算法 / 重放 / 輪替後失效 / 格式異常回 401 不是 500)+ 第 7 項由 `scripts/check-jwt-timing.sh` 裁判;commit message 寫「AI 尚未介入」。**本 session 不寫測試也不寫實作。**
- [ ] T011b 📅9/19 🖐 乾淨 session(空目錄 + brief:「在 Cloudflare Workers 上實作 JWT 登入,要有 refresh token」,不給 CLAUDE.md / 規則 IV / 測試)出 `src/lib/jwt.js` 與 auth 路由 → 原文存 `devlog/raw/exp-05-jwt/` → 放進 repo 跑六個測試 + `check-jwt-timing.sh` → 七項逐一記結果(Day 24 的表)。access 15 分 / refresh 30 天 / 重放撤全部(C16、C17)是驗收標準,不是給它的提示
- [ ] T012 📅9/19 `src/lib/db/members.js`(`create`、`findByEmail`、`findById`)與 `src/lib/db/refresh-tokens.js`(`insert`、`rotate(db, hash, now)` 一個 batch:`UPDATE … SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?` + `INSERT`,回 `changes`;`revokeAllForMember`、`revoke`);每個函式吃 `(db, params, now)`
- [ ] T013 📅9/19 `src/routes/_auth.js`:`requireMember`(Bearer → `verify(token, key, c.get('now'))` → `c.set('member')`;失敗 401 `unauthorized`)、`requireStaff`(403 `forbidden`)、`requireOwner(loadEvent)`(`event.owner_id !== member.id` → 403;活動不存在 → 404)
- [ ] T014 [P] 📅9/19 先寫 `tests/domain/validate.test.js` → 實作 `src/domain/validate.js`,規則照 `data-model.md`「驗證規則」表逐條:email 有 `@`、≤ 254、小寫;password ≥ 8;nickname 1–50;name 1–100;時間欄整數毫秒且 `opens_at < deadline_at`;`price_cents` 整數 ≥ 0;`capacity` 整數 ≥ 0;`group_min_qty ≥ 2`;pct 0–100;`hold_ttl_minutes` 5–30;`seat_nos` 非空、去重後長度不變、每個符合 `^[A-J](10|[1-9])$`、≤ 100;`promo_code` 1–32 存大寫。錯誤一律回 `{ error: 'invalid_input' }`
- [ ] T015 [P] 📅9/20 先寫 `tests/domain/states.test.js` → 實作 `src/domain/states.js`:活動 `draft→on_sale→closed→finished`(無 cancelled)、hold/訂單 `holding→confirmed→checked_in`、`holding→expired|cancelled`、`confirmed→cancelled`、`checked_in`/`cancelled`/`expired` 終態;`canTransition(kind, from, to)` 純函式
- [ ] T016 [P] 📅9/20 `tests/helpers/auth.js`:`register(app, env, {email, nickname})`、`login(app, env, {email})` 回 `{ access, refresh }`、`makeStaff(db, memberId)` 直接 `UPDATE members SET role='staff'`(角色只能 SQL 改,測試也一樣)
- [ ] T017 📅9/20 `src/app.js` 掛 `hono/cors`(`origin: env.CORS_ORIGIN`、`allowHeaders: ['authorization','content-type']`、`exposeHeaders: ['x-server-now']`);實作 `POST /auth/register`(400 / 409 `email_taken` / 201 `Member`)與 `POST /auth/login`(401 / 200 `TokenPair`,access 15 分鐘 `exp`,refresh 30 天存 hash)於 `src/routes/auth.js`;對應 `tests/routes/auth.test.js` 先紅後綠;從 `tests/app.test.js` 的 501 清單移除這兩條

**Checkpoint**: `npm test` 綠、`npm run check:all` 綠、能註冊登入拿到 bearer。所有 story 可以開工。

---

## Phase 3: User Story 1 - 報名:選位、保留、確認(Priority: P1)🎯 MVP

**Goal**: 成員對 `on_sale` 活動建多座 hold(全有全無)、到期前確認(以確認當下票價 + 三層折扣 + 優惠碼)成訂單;逾時釋放、別人搶得到;併發不超賣不重座。

**Independent Test**: 用 `seed.sql` 的活動與票種(不經 US2 endpoint),跑 `tests/routes/holds.test.js` + `tests/concurrency.test.js` 重跑 5 次。

**⚠️ 三個 🖐 實驗(T018 金額、T020 時間、T030 併發)是文章 Day 25 / 26 / 27 的素材,順序不可逆。**

### 金額引擎(實驗二)

- [ ] T018 📅9/24 🖐 [US1] **作者手寫 `src/domain/money.js`,AI 不得先出版本**。介面照 `research.md` R4:`applyPct(cents, pct)` = `Math.floor((cents * (100 - pct) + 50) / 100)`;`quote({ unit_price_cents, qty, early_bird_pct, group_min_qty, group_pct, promo_cents })` → `{ subtotal_cents, after_early_bird_cents, after_group_cents, promo_cents, total_cents }`,先乘後減、整筆小計不逐座、`total_cents` 下限 0。**先寫紅的 `tests/domain/money.test.js`**:向量 100000/10/10/10000 → 71000;反向探針 72900、70000 不得出現;33333×3 早鳥 10 → 89999;5000 − 6000 → 0;`qty < group_min_qty` 不套團體。`npm run check:money` 綠。commit「AI 尚未介入」
- [ ] T019 📅9/25 🖐 [US1] 乾淨 session 出 AI 版金額引擎(prompt 只給折扣三層與順序,不給硬規則)→ `devlog/raw/exp-02-money/` → 用同一份 `tests/domain/money.test.js` 與 `check-money.sh` 量 → 差異寫 devlog,另外 commit

### 時間判定(實驗三)

- [x] T020 📅9/26 ~~🖐~~ [US1] **(2026-09-27 改:寫作 session 寫、作者審)** **作者手寫 `src/domain/time-rules.js`,AI 不得先出版本**。介面照 R5:`canHold(event, now)` → `{ ok, reason }`,`status !== 'on_sale'` 回 `not_on_sale`、`now < opens_at` 回 `not_open_yet`、`now >= deadline_at` 回 `deadline_passed`(**兩個真相來源分開回**);`isEarlyBird(ticketType, now)`(`early_bird_until` 為 null → false);`isHoldExpired(hold, now)`(`expires_at <= now`);`holdExpiresAt(now, ttlMinutes)`。**先寫紅的 `tests/domain/time-rules.test.js`**:每個邊界一條,含「剛好等於 `opens_at`」「剛好等於 `deadline_at`」「剛好等於 `expires_at`」。`npm run check:time` 綠。commit「AI 尚未介入」
- [x] T021 📅9/27 🖐 [US1] 乾淨 session 出 AI 版時間判定 → `devlog/raw/exp-03-time/` → 同一份測試量(預期它會自己 `Date.now()`,那正是 A3 實驗要抓的)→ devlog,另外 commit

### 併發(實驗四)—— 測試先於機制

- [ ] T022 📅9/28 [US1] 先寫 `tests/concurrency.test.js`(此時全紅):用 `tests/helpers/gate.js` 的 `runConcurrently`,(a) SC-001 名額 M = 3、N = 8 個成員各 hold 1 座不同座位並 confirm → 成功數 = 3、成功 + 失敗 = 8;(b) SC-002 N = 8 搶 `A1` → 恰一個 201,其餘 409 `seat_taken`;(c) SC-004 三方競態:hold 到期瞬間 `clock.set(expires_at)`,原持有人 confirm、他人 hold 同座、`sweepExpired` 三者閘門同放 → 斷言結果集合,並在檔頭註解「哪個贏是 T030 的決定,此測試只釘住每次一樣」;(d) 多座全有全無:`["A1","A2"]` 其中 `A2` 已被佔 → 409 且 `A1` 未留下;(e) 票種名額不足 → 409 `sold_out` 且座位未留下。CI 的 `hashFiles` 條件會自動啟用「重跑 5 次」
- [ ] T023 [P] 📅9/28 [US1] 先寫 `tests/routes/holds.test.js`(紅):`closed` → 409 `not_on_sale`;只推時間過 `deadline_at` → 409;未到 `opens_at` → 409;已有有效 hold → 409 `hold_exists`;非本人 DELETE / confirm → 404;過期後 confirm → 409 `hold_expired` 且座位可被他人 hold;主動放棄 → 204 且座位釋放;`hold_ttl_minutes` 生效(`expires_at = now + ttl`);回應帶 `server_now`
- [ ] T030 📅9/29 🖐 [US1] **作者手寫 `src/lib/db/holds.js`,AI 不得先出版本**。`createHold(db, { eventId, memberId, ticketTypeId, seatNos, ttlMinutes }, now)`:一個 `db.batch()`,第一句翻過期(`UPDATE seat_holds SET status='expired' WHERE event_id=? AND seat_no IN (…) AND status='holding' AND expires_at <= ?`),然後名額與座位裁決 —— **⚠️1 的三個候選(R6 a/b/c)在這裡選,plan 沒選**;裸 `INSERT` 靠部分唯一索引拋錯回滾;`SQLITE_CONSTRAINT` 映射到 409 `seat_taken` / `hold_exists` / `sold_out`。`releaseHold(db, {holdId, memberId}, now)`:`UPDATE … WHERE hold_id=? AND member_id=? AND status='holding'` 看 `changes`。`sweepExpired(db, now)`:一句 `UPDATE … WHERE status='holding' AND expires_at <= ?` 回 `changes`。驗收:T022 (b)(c)(d)(e) + T023 綠,`for i in 1 2 3 4 5; do npm run test:race; done` 一致;`npm run check:race` 綠。commit「AI 尚未介入」
- [ ] T031 📅9/30 🖐 [US1] 乾淨 session 出 AI 版 `holds.js`(prompt 只給行為契約 FR-030–035,不給 R6、不給「WHERE 裡」)→ `devlog/raw/exp-04-concurrency/` → 同一份 `concurrency.test.js` 重跑 5 次量 → devlog,另外 commit

### hold 與確認 endpoint

- [ ] T032 📅10/1 [US1] `src/lib/db/ticket-types.js` 補 `findById`、`src/lib/db/promo-codes.js`(`findByCode`、`usedBy(db, {memberId, eventId, code})`)、`src/lib/db/orders.js` 的 `insertConfirmed(db, { hold, quote, items, promoCode }, now)`:一個 batch —— `UPDATE seat_holds SET status='confirmed' WHERE hold_id=? AND member_id=? AND status='holding' AND expires_at > ?`(看 `changes`,0 → 409 `hold_expired`)+ `INSERT orders`(所有 `*_cents` 一次寫入,之後**永不 UPDATE**)+ N 個 `INSERT order_items(unit_price_cents 快照)`;`npm run check:snapshot` 綠
- [ ] T033 📅10/1 [US1] 實作 `POST /events/:id/holds`、`DELETE /holds/:id`、`POST /holds/:id/confirm` 於 `src/routes/holds.js` 與 `src/routes/events.js`:confirm 流程 = 讀 hold(非本人 → 404)→ **只查 `isHoldExpired`,不再查活動狀態**(C13 推論)→ 讀票種現價(C10)→ `isEarlyBird` → `quote()` → 優惠碼(`valid_until`、`event_id` 相符或 NULL、未用過,否則 409 `promo_rejected`)→ `insertConfirmed` → 201 `Order`(含 `qr_payload`,T045 之前先回空字串並在契約測試標 todo);T022、T023 全綠;從 `tests/app.test.js` 501 清單移除三條
- [ ] T034 📅10/1 [US1] `src/worker.js` 的 `scheduled()` 接 `ctx.waitUntil(sweepExpired(env.DB, Date.now()))`,`console.log` 清掉幾筆(給 `wrangler tail`);`tests/worker.test.js` 用 `clock` 推過期後呼叫一次,斷言 `changes`

**Checkpoint**: MVP —— seed 活動上能 hold → confirm → 讀回訂單;`test:race` 5 次一致;五支裁判綠。

---

## Phase 4: User Story 2 - 主辦建活動與票種、改名額 / 時間 / 價格、提前截止(Priority: P2)

**Goal**: staff 建活動(直接 `on_sale`、owner = 建立者、固定 100 席)、主辦加票種(Σ capacity ≤ 100)、改時間 / 名額 / 價格、close;非主辦(含其他 staff)403。

**Independent Test**: `tests/routes/events.test.js` + `tests/routes/ticket-types.test.js`:兩個 staff 帳號互相 PATCH → 403。

- [ ] T024 [P] 📅9/21 [US2] 先寫 `tests/routes/events.test.js`(紅):member `POST /events` → 403;staff 建 → 201 且 `status='on_sale'`、`owner_id` = 自己、`hold_ttl_minutes` 預設 10、給 3 或 31 → 400;另一個 staff PATCH / close → 403;`GET /events` 預設不含 `draft`(SQL 塞一筆 draft 驗證),主辦看得到自己的 draft;`?status=on_sale` 篩選;`GET /events/:id` 回 100 個 `seats`(`free/held/sold/mine`)、`ticket_types`、`my_hold`;`PATCH` 名額 < 已售 → 409 `capacity_below_sold`;close → `closed`,之後 hold → 409(hold 部分等 T033 後補斷言)
- [ ] T025 [P] 📅9/21 [US2] 先寫 `tests/routes/ticket-types.test.js`(紅):非主辦 → 403;Σ capacity > 100 → 409 `capacity_exceeded`;`early_bird_pct` 101 → 400;`PATCH /ticket-types/:id` 改價 → 200,既有訂單 `total_cents` 不變(斷言等 T033 後補)
- [ ] T026 📅9/22 [US2] `src/lib/db/events.js`:`create`(status 固定 `on_sale`)、`list(db, {status, viewerId}, now)`(draft 只給 owner)、`findById`、`update`(時間 / 折扣參數 / ttl)、`close`(`UPDATE … WHERE id=? AND owner_id=? AND status='on_sale'` 看 `changes`)、`seatMap(db, eventId, viewerId, now)`(100 席狀態:`holding` 且未過期 = held / `confirmed` = sold / 本人 = mine)
- [ ] T027 📅9/22 [US2] `src/lib/db/ticket-types.js`:`create`(同活動 Σ capacity 檢查要在 SQL 裡:`INSERT … SELECT … WHERE (SELECT COALESCE(SUM(capacity),0) FROM ticket_types WHERE event_id=?) + ? <= 100` 看 `changes`,或等價寫法)、`updatePrice`、`updateCapacity`(`UPDATE … SET capacity=?, remaining = remaining + (? - capacity) WHERE id=? AND ? >= capacity - remaining` 看 `changes`,`CHECK (remaining >= 0)` 兜底)、`listByEvent`
- [ ] T028 📅9/23 [US2] 實作 `POST /events`、`GET /events`、`GET /events/:id`、`PATCH /events/:id`、`POST /events/:id/close` 於 `src/routes/events.js`(用 `requireStaff` / `requireOwner`、`validate.js`);`src/presentation/events.js` 組 `EventSummary` / `EventDetail`;T024 綠;501 清單移除五條
- [ ] T029 📅9/23 [US2] 實作 `POST /events/:id/ticket-types`、`PATCH /ticket-types/:id` 於 `src/routes/ticket-types.js`;T025 綠;501 清單移除兩條;`npm run test:contract` 綠

**Checkpoint**: 主辦可從零建出一場可報名的活動;越權全部 403。

---

## Phase 5: User Story 3 - 成員註冊、登入、續期、登出(Priority: P3)

**Goal**: refresh 輪替、重放偵測撤全部、logout、七項邊界納入驗收。(註冊 / 登入已在 Phase 2 T017 做完,因為所有 story 都要 token。)

**Independent Test**: `tests/routes/auth.test.js` 走完「登入 → refresh → 舊 refresh 再用 → 401 且新 refresh 也失效 → 重登 → logout → 401」。

- [ ] T035 📅10/2 [US3] `tests/routes/auth.test.js` 補(紅):refresh 成功回新 pair 且舊 refresh 再用 → 401 `refresh_replayed`;重放後**新發的 refresh 也失效**(C17);`expires_at` 過了 → 401;logout → 204,再 refresh → 401;logout 不帶 body → 400
- [ ] T036 📅10/2 [US3] 實作 `POST /auth/refresh`(`rotate` 的 `changes = 0` → 查該 hash:存在且 `revoked_at` 非 NULL → `revokeAllForMember` + 401 `refresh_replayed`;不存在或過期 → 401 `unauthorized`)與 `POST /auth/logout`(`revoke`)於 `src/routes/auth.js`;T035 綠;501 清單移除兩條
- [ ] T037 📅10/2 [US3] `tests/jwt.test.js` 七個 `it.todo` 改成讀環境變數 `JWT_BOUNDARIES=<repo 外清單路徑>`:有給就 `import()` 該檔跑七項,沒給就 `it.skip` 並印「外部清單未掛」;`docs/verified.md` ❌ 欄「JWT 七項邊界」維持到清單跑過

**Checkpoint**: 完整認證生命週期可測;`npm run test:jwt` 綠。

---

## Phase 6: User Story 4 - 我的票券與歷史(web 與 iOS)(Priority: P4)

**Goal**: `GET /orders`、`GET /orders/:id`(含 `qr_payload`)、web 五畫面(Pages + daisyUI)、iOS 三畫面(OpenAPI client、離線讀取快取);兩端對同一個 GET 顯示同一份資料;讀取次數有量。

**Independent Test**: 同一帳號在 web 與 iOS 各載入「活動列表」與「我的票券」,逐欄與 `curl GET /events` / `GET /orders` 比對;`docs/verified.md` 記 rows_read。

### API 側

- [ ] T038 [P] 📅10/3 [US4] 先寫 `tests/lib/hmac.test.js` → 實作 `src/lib/hmac.js`:`qrPayload(orderId, key)` = `"<orderId>.<base64url(HMAC-SHA256(orderId))[0:22]>"`,用 `crypto.subtle.sign`;不含任何個資
- [ ] T039 [P] 📅10/3 [US4] `src/presentation/money.js`(`centsToDisplay(cents)` → `"1,000"` 元字串,**唯一可以 `/ 100` 的地方**)與 `src/presentation/orders.js`(組 `Order` schema:`items[]` 帶 `ticket_type_name`、`event_name`、`qr_payload`)
- [ ] T040 📅10/3 [US4] 先寫 `tests/routes/orders.test.js`(紅):`GET /orders` 只回本人;`GET /orders/:id` 本人 200、主辦 200、其他成員 404;`qr_payload` 格式與可用同 key 重算驗證;改票價後重讀 `total_cents`、`items[].unit_price_cents` 不變 → 實作 `src/lib/db/orders.js` 的 `listByMember`(**一次 JOIN 查詢**,`meta.rows_read` 記下來)、`findById`;`GET /orders`、`GET /orders/:id` 於 `src/routes/orders.js`;501 清單移除兩條;T033 的 `qr_payload` 空字串換成真的

### web(Cloudflare Pages)

- [x] T041 📅10/4 [US4] 建 `web/`:`npm create vite@latest web -- --template vanilla`、Tailwind v4 + daisyUI v5(`@import "tailwindcss"; @plugin "daisyui";`)、`vite.config.js` 的 `server.proxy['/api'] → http://127.0.0.1:8788`(rewrite 去掉 `/api`);`web/src/api.js`(bearer、401 自動 refresh 一次、讀 `x-server-now` 更新 `serverNow`);`web/src/lib/money.js`(**web 唯一分 → 元**);`web/src/lib/countdown.js`(以 `server_now` 校正的倒數)
- [x] T042 📅10/4 [US4] `web/src/pages/login.js`(登入 / 註冊表單,token 存 memory + `localStorage.refresh`)與 `web/src/pages/events.js`(列表,`?status=on_sale` 切換,daisyUI card)
- [x] T043 📅10/5 [US4] `web/src/pages/event.js`:10×10 座位格(`seats[]` 的 `free/held/sold/mine` 四色,daisyUI btn)、票種選單、多選 → `POST /events/:id/holds`;409 各代碼顯示原始 `error` 字串(錯誤訊息不友善是刻意的)
- [x] T044 📅10/5 [US4] `web/src/pages/hold.js`:倒數(`countdown.js`)、優惠碼輸入、確認 → `POST /holds/:id/confirm`、放棄 → `DELETE`;倒數歸零改顯示已過期並回活動頁
- [x] T045 📅10/6 [US4] `web/src/pages/tickets.js`:`GET /orders` 列表 + 明細,`qrcode` npm 套件畫 `qr_payload`,金額經 `lib/money.js`;取消按鈕(US5 的 T050 之後接上)
- [x] T046 📅10/6 [US4] `scripts/check-money.sh` 掃描範圍加 `web/src`、排除 `web/src/lib/money.js`;`scripts/self-test.sh` 加兩筆探針(web 裡裸 `/100` 要紅、`lib/money.js` 裡不誤報);`sh scripts/self-test.sh` 全綠

### iOS 骨架

- [x] T047 📅10/7 [US4] 建 `ios/EventSignup/`(SwiftPM,iOS 17,SwiftUI);`Package.swift` 加 `swift-openapi-generator`(plugin)、`swift-openapi-runtime`、`swift-openapi-urlsession`;`Sources/EventSignup/openapi.yaml` 由 repo 根複製(加 `scripts/sync-openapi.sh` 一行 `cp`);`openapi-generator-config.yaml`(`generate: [types, client]`);build 通過、`Client` 型別出現
- [x] T048 📅10/8 [US4] `ios/EventSignup/Sources/EventSignup/Auth/LoginView.swift` + `Auth/TokenStore.swift`(Keychain)+ `Auth/BearerMiddleware.swift`(`ClientMiddleware`,401 → refresh 一次重試)
- [x] T049a 📅10/9 [US4] `ios/EventSignup/Sources/EventSignup/Events/EventListView.swift`(`GET /events?status=on_sale`,daisyUI card 的對應:名稱、開賣 / 截止、票種與剩餘)+ `Events/EventDetailView.swift`(`GET /events/:id`,畫 100 席 `free/held/sold/mine` 四色,**唯讀不可點**;FR-071 不做選位);不做離線快取
- [x] T049b 📅10/9 [US4] `ios/EventSignup/Sources/EventSignup/Tickets/TicketListView.swift`、`Tickets/TicketDetailView.swift`(CoreImage `CIFilter.qrCodeGenerator()` 畫 `qr_payload`;金額顯示集中 `Tickets/Money.swift`)、`Cache/OrdersCache.swift`(最後一次 `GET /orders` 原始 JSON 存 Application Support;離線時讀並顯示「離線資料」;登出離線時提示需連線)

**Checkpoint**: 同一帳號 web / iOS / curl 三者 `GET /events` 與 `GET /orders` 各自逐欄一致(SC-007);rows_read 已記(SC-008)。

---

## Phase 7: User Story 5 - 取消訂單(Priority: P5)

**Goal**: 本人取消 `confirmed` 訂單 → `cancelled`、座位釋放可再售;`checked_in` / `cancelled` → 409;退款不算。

**Independent Test**: `tests/routes/orders.test.js` 的取消段:取消 → 同座位他人 hold 201 → 再取消 → 409。

- [ ] T050 📅10/2 [US5] `tests/routes/orders.test.js` 補(紅):取消 → 200 `status=cancelled`、`total_cents` 不變(只改 status);同座位他人 hold → 201;再取消 → 409 `terminal_state`;SQL 把訂單改 `checked_in` 後取消 → 409;非本人 → 404 → 實作 `src/lib/db/orders.js` 的 `cancel(db, {orderId, memberId}, now)`:一個 batch —— `UPDATE orders SET status='cancelled' WHERE id=? AND member_id=? AND status='confirmed'`(看 `changes`)+ `UPDATE seat_holds SET status='cancelled' WHERE hold_id=? AND status='confirmed'`;**不碰任何 `*_cents`**;`POST /orders/:id/cancel` 於 `src/routes/orders.js`;501 清單清空(17/17 移除);`npm run check:snapshot` 綠

**Checkpoint**: 17 條 endpoint 全部脫離 501;`npm run test:contract` 綠。

---

## Phase 8: Polish & Cross-Cutting(10/3、10/10–10/13)

- [ ] T051 📅10/3 `scripts/smoke.sh` 填實:照 `quickstart.md` 第 3 節的 curl 流程(註冊 → 登入 → 建活動 → 票種 → 4 座 hold → 帶 `WELCOME` 確認 → 斷言 `total_cents = 314000` → 改價 → 重讀不變 → 取消 → 重 hold A1 → 201);`npm run smoke` 對 `wrangler dev`
- [ ] T052 📅10/3 部署:`wrangler d1 create signup` 換掉 `wrangler.toml` 的 placeholder id、`wrangler secret put JWT_SECRET / QR_SECRET`、`wrangler d1 execute signup --remote --file=schema.sql`、`wrangler deploy`;`BASE_URL=<worker> npm run smoke`
- [ ] T053 📅10/3 `scripts/race.sh` 填實:對遠端 Worker 用 `xargs -P 20 curl` 打同一座位 20 次與同票種名額 + 5 次,統計 201 / 409 數量,寫 `devlog/raw/race-<date>.txt`;結果進 `docs/verified.md` ✅「真實併發」
- [ ] T054 [P] 📅10/10 Pages 部署:`web/` 連 Pages 專案、`VITE_API_BASE` 指向 Worker、Worker 的 `CORS_ORIGIN` 改成 Pages 網域;線上走一遍五畫面
- [ ] T055 [P] 📅10/10 SC-007 / SC-008 實測:同帳號 web、iOS、curl 三份 `GET /events` 與三份 `GET /orders` 各自逐欄 diff;`rows_read` 數字;寫進 `docs/verified.md` ✅ 欄(有輸出可貼的才進)
- [ ] T056 📅10/11 `docs/verified.md` 全面對帳:❌ 欄逐項移到 ✅ 或留著(JWT 七項若外部清單沒跑,留著);「已知的坑」補這 30 天踩到的
- [ ] T057 [P] 📅10/11 CLAUDE.md 與 `.specify/memory/constitution.md` 規則 V 的註記改為「另一半由 `tests/schema.test.js` ⑥ 裁判」(research.md 末段);`/speckit-constitution` 走 PATCH 版本
- [ ] T058 [P] 📅10/12 `README.md`「現在的狀態」改寫:尺與被量的東西都有了;指令表補 `web`、`ios`、`race`
- [ ] T059 📅10/12 CI 帳本:從 `.github/workflows/ci.yml` 的 job summary 數「量了幾次、擋下幾次」,寫 `devlog/LEDGER`(Day 30 素材)
- [ ] T060 📅10/13 收尾緩衝:`sh scripts/self-test.sh && npm run check:all && npm test && for i in 1 2 3 4 5; do npm run test:race || exit 1; done` 全綠;沒綠的項目**不補綠**,寫進 `docs/verified.md` ❌ 欄

---

## Dependencies & Execution Order

### Phase 相依

- **Setup(1)** → **Foundational(2)**:T007 schema 必須在任何 `lib/db` 之前;T017 註冊 / 登入必須在任何 route 測試之前
- **Foundational** → 所有 story
- **US1(3)** 內部:T018 → T019、T020 → T021、T022+T023 → T030 → T031 → T032 → T033 → T034;T018 與 T020 可先於 T022
- **US2(4)** 不依賴 US1,可插在 T021 與 T022 之間(日期 9/21–9/23 就是這樣排的:金額 / 時間實驗前的空檔)
- **US3(5)** 只依賴 Phase 2;排 10/2 是因為它不擋任何人,先做重心
- **US4(6)** API 側(T038–T040)依賴 T033(要有訂單可讀);web 依賴 US1–US3 的 endpoint 全部存在;iOS 依賴 `openapi.yaml`(T002)與 T040
- **US5(7)** 依賴 T032(訂單存在)與 T030(座位釋放靠 seat_holds 狀態)
- **Polish(8)** T051–T053 依賴 17 條全上;T054–T055 依賴 web / iOS

### 🖐 實驗鏈(不可逆,每個都是「作者 → AI → 比對」三步)

```
T007 schema(9/16) → T008
T018 money(9/24) → T019
T020 time(9/26) → T021
T030 concurrency(9/29) → T031      ← ⚠️1 的三個候選在這裡選
```

### 可並行

- Phase 1:T003、T004、T005、T006 同日並行
- Phase 2:T009 / T010 / T011 並行;T014 / T015 / T016 並行
- US1:T022 與 T023 並行(都是紅測試)
- US2:T024 與 T025 並行;T026 與 T027 並行
- US4:T038 與 T039 並行;iOS(T047–T049)可與 web 交錯,但一人全端所以日期上是序列
- Polish:T054 / T055、T057 / T058 並行

---

## Implementation Strategy

**MVP = Phase 1 + 2 + US1(到 T034)**:seed 的活動上能 hold → confirm → 讀回,併發 5 次一致。這是 spec ⭐ 那列,也是文章 Day 25–27 的全部素材。
US2 只是讓主辦不用下 SQL;US3 的 refresh 是安全性;US4 / US5 是兩端顯示與收尾。**若時間不夠,砍的順序是 iOS → web 的活動頁選位(改成只有票券頁)→ US3 的重放偵測(保留輪替)**;US1 的三個實驗不能砍。

---

## 日期 × 里程碑總表

一人全端 + 每天一篇文,每天只排半天工程量。「文章 Day」欄是該天工程對應的素材篇,**不是**發文日 —— 對照你自己的施工表時以這欄對齊。

| 日期 | 星期 | Task | 里程碑 | 文章 Day 素材 |
|---|---|---|---|---|
| 9/14 | 日 | T001 | 作者回寫 `docs/spec.md`(21 個決定) | — |
| 9/15 | 一 | T002–T006 | `openapi.yaml` 進 repo 根(契約先行 commit);契約測試 501 階段綠;clock 注入 | Day 23 |
| 9/16 | 二 | T007 🖐 | **schema.sql 作者手寫**,`test:schema` 8/8 | Day 22 |
| 9/17 | 三 | T008 🖐、T009 | AI 版 schema 比對;seed.sql | Day 22 |
| 9/18 | 四 | T010、T011 🖐 | password;**作者寫 JWT 六個測試並 commit** | Day 24 |
| 9/19 | 五 | T011b 🖐、T012–T014 | **乾淨 session 出 JWT 實作,跑七項**;members / refresh-tokens SQL、auth middleware、validate | Day 24 |
| 9/20 | 六 | T015–T017 | states、auth helper、CORS、**註冊 / 登入上線** —— Phase 2 checkpoint | Day 24 |
| 9/21 | 日 | T024、T025 | US2 紅測試 | — |
| 9/22 | 一 | T026、T027 | events / ticket-types SQL(Σ capacity、capacity < sold 都在 SQL 裡) | — |
| 9/23 | 二 | T028、T029 | **活動 5 條 + 票種 2 條上線** —— US2 checkpoint | — |
| 9/24 | 三 | T018 🖐 | **money.js 作者手寫**,71000 向量 | Day 25 |
| 9/25 | 四 | T019 🖐 | AI 版金額引擎比對 | Day 25 |
| 9/26 | 五 | T020 🖐 | **time-rules.js 作者手寫**,兩個真相來源 | Day 26 |
| 9/27 | 六 | T021 🖐 | AI 版時間判定比對 | Day 26 |
| 9/28 | 日 | T022、T023 | concurrency.test.js + holds 路由測試(全紅) | Day 27 |
| 9/29 | 一 | T030 🖐 | **holds.js 作者手寫;⚠️1 三候選在此選**;`test:race` 5 次一致 | Day 27 |
| 9/30 | 二 | T031 🖐 | AI 版併發比對 | Day 27 |
| 10/1 | 三 | T032–T034 | **hold 3 條上線、確認建單含快照、Cron sweep** —— US1 / MVP checkpoint | Day 25–27 |
| 10/2 | 四 | T035–T037、T050 | refresh 輪替 / 重放撤全部 / logout;取消訂單 —— **17/17 脫離 501** | Day 24 |
| 10/3 | 五 | T038–T040、T051–T053 | orders 兩條 + QR;smoke 填實;**首次部署**;race.sh 真實併發 | Day 27 |
| 10/4 | 六 | T041、T042 | web 腳手架、api.js、登入 / 列表 | Day 28 |
| 10/5 | 日 | T043、T044 | 10×10 選位、倒數與確認 | Day 28 |
| 10/6 | 一 | T045、T046 | 票券 + QR;check-money 擴掃 web —— **web 五畫面完成** | Day 28 |
| 10/7 | 二 | T047 | iOS 專案 + OpenAPI client 產生 | Day 29 |
| 10/8 | 三 | T048 | iOS 登入 + Keychain | Day 29 |
| 10/9 | 四 | T049a、T049b | iOS 活動列表(唯讀)+ 票券列表 / 明細 / 離線快取 —— **iOS 三畫面完成**(當天兩個 task) | Day 29 |
| 10/10 | 五 | T054、T055 | Pages 上線;SC-007 三端逐欄比對、SC-008 rows_read | Day 29 |
| 10/11 | 六 | T056、T057 | `verified.md` 對帳;constitution 規則 V 註記更新 | Day 30 |
| 10/12 | 日 | T058、T059 | README、CI 帳本(量了幾次 / 擋下幾次) | Day 30 |
| 10/13 | 一 | T060 | 全綠檢查;沒綠的進 ❌ 欄,不補綠 | Day 30 |

**風險點**(排得最緊的三天):9/29(T030 是整個專案最難的一段,又是實驗)、10/1(六條 endpoint 一天)、10/3(六個 task)。
若 9/29 滑一天,10/1–10/3 順延,砍 10/13 的緩衝;若再滑,先砍 iOS(T047–T049 改成只做 T047 的 client 產生)。
