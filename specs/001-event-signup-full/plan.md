# Implementation Plan: 活動報名系統(完整功能)

**Branch**: `001-event-signup-full` | **Date**: 2026-09-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-event-signup-full/spec.md`

> **技術棧已定,本 plan 不換**(使用者指示):Workers + Hono、D1、Pages + Tailwind + daisyUI、SwiftUI、
> 自製 JWT、單一 OpenAPI 餵兩端、vitest、`scripts/` 五支裁判。

## Summary

18 條 endpoint(2026-09-27 加試算 `POST /holds/:id/quote`)的活動報名 API(Workers + Hono + D1)、一份 OpenAPI 契約、一個 Pages 前端(五個畫面)、
一個 SwiftUI 骨架(三個畫面)。核心是售票規則:限量名額、多座 hold 全有全無、保留逾時三方競態、
先乘後減的整數折扣、確認後金額快照。技術上的關鍵限制只有一個:**D1 沒有 `SELECT … FOR UPDATE`**,
併發只能靠條件式寫入 + `changes` + `CHECK`,而 `db.batch()` 只在**拋錯**時回滾,`changes = 0` 不回滾。

**這份 plan 有兩種區域**(`docs/EXPERIMENT-PROTOCOL.md`,順序不可逆):

| 區域 | 內容 | 本 plan 做到哪 |
|---|---|---|
| **作者手寫區(實驗對象)** | schema、金額引擎與折扣順序、時間判定、併發(超賣 / 座位 / TTL) | 只寫**介面、不變條件、驗收測試**;不寫 DDL、不寫演算法、不寫 SQL 語句順序 |
| **寫作 session 可實作區** | 骨架接線、JWT、契約、web、iOS、CI、測試基礎設施 | 寫到可以直接切 task |

## Technical Context

**Language/Version**: JavaScript(ESM,Node 22 跑測試;Workers runtime 跑正式)· Swift 5.10+ / Xcode 16(iOS)

**Primary Dependencies**: `hono@^4.10`、`wrangler@^4.128`(含 miniflare D1 給測試用)· web:Vite + Tailwind v4 + daisyUI v5 · iOS:`swift-openapi-generator` + `swift-openapi-urlsession`

**Storage**: Cloudflare D1(SQLite;binding `DB`,`database_name = signup`)。無 `SELECT … FOR UPDATE`、無 advisory lock;`db.batch()` 是隱含交易,只在拋錯時回滾。

**Testing**: vitest(`fileParallelism: false`);D1 用 `getPlatformProxy({ persist: false })` 拿真的 miniflare D1,不用 shim;併發一律 `tests/helpers/gate.js` 閘門;壓測 `scripts/race.sh`(目前空殼);靜態裁判 `npm run check:all`;裁判的裁判 `scripts/self-test.sh`

**Target Platform**: Cloudflare Workers(API + Cron Trigger)· Cloudflare Pages(web)· iOS 17+(骨架)

**Project Type**: web-service + web 前端 + mobile 骨架,單一 repo

**Performance Goals**: 無(非目標 14:效能優化除非免費額度真的爆)。唯一要量的是 SC-008「我的票券一次載入的 D1 讀取次數」,量了記下來,不設目標值。

**Constraints**: 五條硬規則(見 Constitution Check);15 條非目標;無 rate limit、錯誤訊息不友善、無 log 聚合(刻意保留的醜);免費額度

**Scale/Scope**: 18 endpoint(原 17,2026-09-27 加試算)+ `/health`;8 張表上限(`tests/schema.test.js` ⑦ 的白名單);每活動 100 席;web 5 畫面;iOS 3 畫面;十天

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

逐條對照 `.specify/memory/constitution.md` 的五條硬規則。**⚠️ 標的是設計與規則有張力、要在實作前決定的地方。**

### I. 金額一律用整數最小單位 —— 裁判 `scripts/check-money.sh`

| 檢查 | 結果 |
|---|---|
| API 內外全部用 `*_cents` 整數;OpenAPI 所有金額欄 `type: integer` | ✅ 契約已如此寫(`contracts/openapi.yaml`) |
| 折扣公式 `floor((cents × (100 − pct) + 50) / 100)` 是裁判認可的唯一 `/100` 寫法 | ✅ 引擎屬作者手寫區,plan 只規定簽章與範例(`research.md` R4) |
| 顯示轉換只在 `src/presentation/` | ✅ API 側成立 |
| **web 前端的分 → 元** | ⚠️ `web/` 不在 `check-money.sh` 掃描範圍(它只掃 `src/`)。設計:web 的金額顯示集中在**一個檔** `web/src/lib/money.js`,並**擴大 `check-money.sh` 掃 `web/src`、排除該檔**;裁判改了要補 `self-test.sh` 探針。iOS 同理,但 Swift 不在任何裁判範圍 —— 只能靠 code review,記在 `docs/verified.md` ❌ 欄 |

### II. 時間是參數,不是副作用 —— 裁判 `scripts/check-time-injection.sh`

| 檢查 | 結果 |
|---|---|
| `src/domain/` 零 `Date.now()` / `new Date()` | ✅ 現有 middleware 已在 `app.js` 取 `now` 塞進 context;`scheduled()` 是另一個取時間點 |
| 所有 domain 函式簽章帶 `now` | ✅ `research.md` R5 規定簽章形狀 |
| web 倒數用 `x-server-now`,不用瀏覽器時鐘 | ✅ header 已存在 |
| JWT 的 `iat` / `exp` 判定 | ✅ `verify(token, key, now)`,`now` 從 route 傳入;不在 lib 裡自己取 |

### III. 併發判斷必須在 SQL 的 `WHERE` 裡 —— 裁判 `scripts/check-concurrency.sh`

| 檢查 | 結果 |
|---|---|
| 單語句的條件式寫入(放棄 hold、取消訂單、改價、close)都是 `UPDATE … WHERE id = ? AND status = ? …` + 看 `changes` | ✅ |
| 座位唯一性靠部分唯一索引(述詞含 `confirmed`),`INSERT` 衝突拋錯 → batch 整批回滾 | ✅ 這正是「`CHECK`(這裡是 UNIQUE)當第二道防線」 |
| **票種名額在多語句 batch 裡的裁決** | ⚠️ **規則的字面與 D1 的行為有張力。** 規則要「條件寫在 `WHERE` + 檢查 `changes`」;但 `db.batch()` 只在拋錯時回滾,`UPDATE … WHERE remaining >= ?` 的 `changes = 0` **不會**讓同批的 `INSERT` 回滾。能讓整批回滾的只有 `CHECK (remaining >= 0)` 拋錯。所以「名額不足 → 整批失敗」在 D1 上,真正做事的是 `CHECK`,`WHERE` 守衛只是讓正常路徑不碰 `CHECK`。**這屬於 Day 27 併發實驗(作者手寫區),plan 不決定機制**,只在 `research.md` R6 記下三種候選與各自跟裁判的關係,並要求:不管選哪種,`tests/concurrency.test.js` 的 SC-001 / SC-002 必須重跑 5 次一致。 |
| 「先翻過期再佔位」在同一 batch | ✅ 行為契約(FR-033),機制屬作者 |

### IV. 簽章比對必須是常數時間 —— 裁判 `scripts/check-jwt-timing.sh`

| 檢查 | 結果 |
|---|---|
| JWT HS256 用 `crypto.subtle.verify`,不重算再 `===` | ✅ `research.md` R2 |
| 票券 QR 的 HMAC —— 本專案只**簽**不**驗**(非目標 13) | ✅ 沒有比對就沒有時序問題;若日後寫查驗端,同樣走 `subtle.verify` |
| refresh token 查找 `WHERE token_hash = ?` | ✅ SQL 等值比對不是常數時間,但比的是隨機 token 的 SHA-256,不是秘密本身;記在 R2 |

### V. 確認後的訂單金額不可變 —— 裁判 `scripts/check-price-snapshot.sh`(只管一半)

| 檢查 | 結果 |
|---|---|
| 金額只在確認那次 `INSERT` 寫入;取消訂單只改 `status` | ✅ 契約與 data-model 如此;裁判擋任何 `UPDATE … SET *_cents` |
| 明細存單價快照,不靠 `ticket_type_id` JOIN | ✅ `tests/schema.test.js` ⑥ 已是自動裁判(要求 `order_items` 有自己的 `_cents` 欄)—— **constitution 說這一半「還沒有自動檢查」已經過時**,`schema.test.js` 落地(2026-09-10)就補上了;建議回寫 CLAUDE.md / constitution 的那段註記 |
| hold 不鎖價(C10):hold 階段**不寫任何金額**,確認時才算 | ✅ 也順便避免「hold 上的金額要不要 UPDATE」的問題 |
| **hold 表頭放哪** | ⚠️ 若把 `orders` 當 hold 表頭(建 hold 時 `INSERT orders(status='holding')`,確認時再填金額),就必須 `UPDATE orders SET total_cents` —— **裁判會擋**。所以 data-model 明寫:訂單列與其金額必須在**確認那一次**才 `INSERT`;hold 的表頭要嘛獨立(`seat_holds` 帶 `hold_id` 分組),要嘛是沒有金額欄的 `orders` 列。**表怎麼拆是作者的 schema 實驗,plan 只寫這條不變條件。** |

### 非目標 / 目錄

| 檢查 | 結果 |
|---|---|
| 沒有新 endpoint(17 + `/health`) | ✅(2026-09-27 作者要求加試算,成 18 條) |
| 表在 `schema.test.js` ⑦ 白名單內(8 張) | ✅ |
| 新欄位只有 spec Clarifications ★ 標的那些(作者決定) | ✅ |
| 目錄 | ⚠️ CLAUDE.md 只列 `domain / routes / presentation`。plan 新增 `src/lib/`(JWT、HMAC、DB 存取)—— 因為 JWT 用 `crypto.subtle` 是 I/O 且 async,不該進 `domain/`;SQL 也不該散在 `routes/`。**要補進 CLAUDE.md 目錄表**,否則等於偷加。 |

**Gate 結論**:無違反;四個 ⚠️ 都是「要在實作前做決定」而非違規,已各自指向 `research.md` 的條目。

## Project Structure

### Documentation (this feature)

```text
specs/001-event-signup-full/
├── spec.md              # 已完成(21 條 Clarifications)
├── spec-writeback.md    # 作者回寫 docs/spec.md 的指引
├── plan.md              # 本檔
├── research.md          # Phase 0:技術決定(R1–R10)
├── data-model.md        # Phase 1:實體、不變條件、狀態轉換 —— 不含 DDL
├── quickstart.md        # Phase 1:端到端驗證流程
├── contracts/
│   └── openapi.yaml     # Phase 1:17 條 + /health 的契約草案(實作時搬到 repo 根)
└── tasks.md             # Phase 2(/speckit-tasks)
```

### Source Code (repository root)

```text
openapi.yaml                 # 契約正本(契約先行:要早於任何回 200 的 handler commit)
schema.sql                   # 作者手寫(Day 22),AI 版另存 devlog/raw/exp-01/
seed.sql                     # db:seed 用;含 1 個 staff、1 個活動、2 票種、1 優惠碼
wrangler.toml                # 已有;要補 [triggers] crons 與 vars

src/
├── worker.js                # fetch + scheduled(已有;scheduled 接 sweepExpired)
├── app.js                   # createApp(已有;補 cors、auth middleware 掛載)
├── domain/                  # 純邏輯,now 從參數進
│   ├── money.js             # applyPct、quote(...)  ← 作者手寫區(Day 25)
│   ├── time-rules.js        # canHold(event, now)、isEarlyBird、isExpired ← 作者手寫區(Day 26)
│   ├── states.js            # 活動 / 訂單狀態轉換表(純資料 + 一個 canTransition)
│   └── validate.js          # 註冊、建活動、票種、hold 的輸入驗證(整數、範圍、seat_no 格式)
├── lib/                     # ⚠️ 新目錄(見 Gate)
│   ├── jwt.js               # sign / verify(HS256,subtle.verify)
│   ├── hmac.js              # 票券 QR 的簽章
│   ├── password.js          # PBKDF2(subtle.deriveBits)
│   └── db/                  # 每張表一個檔,每個函式吃 (db, params, now)
│       ├── members.js  refresh-tokens.js  events.js  ticket-types.js
│       ├── holds.js         # createHold / releaseHold / confirmHold / sweepExpired ← 作者手寫區(Day 27)
│       └── orders.js  promo-codes.js
├── routes/                  # 已有 5 檔;把 501 逐條換成實作
│   ├── _auth.js             # requireMember / requireStaff / requireOwner middleware
│   └── auth.js  events.js  ticket-types.js  holds.js  orders.js
└── presentation/
    └── money.js             # centsToDisplay(唯一可以除以 100 的地方)

tests/
├── app.test.js              # 已有;每接好一條 endpoint 就把它從 501 清單搬走
├── schema.test.js           # 已有(8 組斷言)
├── domain/                  # money / time-rules / states 單元測試(純函式,不碰 D1)
├── routes/                  # 每個 endpoint 一檔,用 withDb() + app.request()
├── jwt.test.js              # 七項邊界(內容在 repo 外;此檔只放 repo 內能寫的那幾項 + 掛外部清單)
├── concurrency.test.js      # SC-001 / 002 / 004,閘門,CI 重跑 5 次
├── contract.test.js         # 每條回應對 openapi.yaml 的 schema 驗
└── helpers/                 # 已有 db.js gate.js;補 auth.js(登入拿 token)、clock.js(可推的 now)

web/                         # Cloudflare Pages
├── index.html  vite.config.js  tailwind/daisyUI 設定
└── src/
    ├── api.js               # fetch 包裝:帶 bearer、401 → refresh 一次、讀 x-server-now
    ├── lib/money.js         # ⚠️ web 唯一的分 → 元
    ├── lib/countdown.js     # 用 server_now 校正
    └── pages/               # login.js  events.js  event.js(10×10)  hold.js  tickets.js

ios/EventSignup/             # SwiftUI 骨架
├── Package.swift / xcodeproj
├── openapi.yaml → 由 repo 根複製(build phase),swift-openapi-generator 產 Client
├── Auth/                    # 登入畫面、Keychain 存 token
├── Events/                  # 活動列表(唯讀)+ 100 席座位圖(T049a)
├── Tickets/                 # 列表 + 明細(含 QR)
└── Cache/                   # 最後一次 GET /orders 的 JSON 落地,離線讀

scripts/                     # 已有;要動的:
├── check-money.sh           # 掃描範圍加 web/src(排除 lib/money.js)+ self-test 探針
├── race.sh                  # 空殼 → 真的打遠端 Worker
└── smoke.sh                 # 空殼 → 建活動 → 選位 → 保留 → 確認 → 出票
```

**Structure Decision**: 單一 repo,三個可部署單位(Worker / Pages / iOS)。API 沿用 CLAUDE.md 的
`domain / routes / presentation` 三層,加 `src/lib/`(I/O 與 SQL)。web 與 ios 各自一個頂層目錄,
不進 `src/`,這樣五支裁判的掃描範圍(`src/`)不會被前端汙染 —— 唯一例外是規則 I 要主動擴到 `web/src`。

## 實作順序(對齊 `docs/EXPERIMENT-PROTOCOL.md`,不可逆)

| 步 | 內容 | 誰 | 產出 |
|---|---|---|---|
| 0 | 作者回寫 `docs/spec.md`(`spec-writeback.md`) | 作者 | commit「作者決定」 |
| 1 | `openapi.yaml` 到 repo 根 + `tests/contract.test.js` 骨架(全部 501 也要對得上 error schema) | 本 session | 契約先行的 commit |
| 2 | **schema.sql** 作者手寫 → `npm run test:schema` 8/8 → 無菌室 AI 版 → 比對 | 作者 → 乾淨 session | Day 22 |
| 3 | JWT + password + refresh 輪替 + `_auth.js` + 4 條 auth endpoint | 本 session | Day 24 |
| 4 | **金額引擎** `domain/money.js` 作者手寫 → 無菌室版 → 比對 | 作者 | Day 25 |
| 5 | **時間判定** `domain/time-rules.js` 作者手寫 → 無菌室版 | 作者 | Day 26 |
| 6 | 活動 5 條 + 票種 2 條 endpoint(接 3、5 的產物) | 本 session | |
| 7 | **併發** `lib/db/holds.js`(createHold / confirm / sweep)作者手寫 → `concurrency.test.js` 重跑 5 次 → 無菌室版 | 作者 | Day 27 |
| 8 | hold 3 條 + 訂單 3 條 endpoint;`smoke.sh`、`race.sh` 填實 | 本 session | |
| 9 | web 五畫面 | 本 session | Day 28 |
| 10 | iOS 三畫面 + OpenAPI client;SC-007 三端比對(`GET /events`、`GET /orders`)、SC-008 讀取次數 | 本 session | Day 29 |
| 11 | `docs/verified.md` 更新;CI 帳本 | 本 session | Day 30 |

> 步 2、4、5、7 的「AI 版」**不能由本 session 產**(它看過考題)。tasks.md 裡這幾項要標「作者手寫」。

## Complexity Tracking

Gate 無違反,本節只記兩個「規則字面 vs 平台行為」的張力,決定權在作者:

| 張力 | 為什麼存在 | 候選(詳 research.md R6) |
|---|---|---|
| 規則 III 要 `WHERE` + `changes`,但 D1 batch 只在拋錯時回滾 | `changes = 0` 不是錯誤 | (a) `WHERE` 守衛 + `CHECK` 兜底,接受「真正回滾的是 `CHECK`」;(b) 兩段式:先單獨跑名額 `UPDATE` 看 `changes`,再 batch 座位 —— 但兩段之間不原子,失敗要補償;(c) 把名額判斷改成座位級(票種綁座位區),名額就變成 UNIQUE 索引的事 —— 改了 C3 的語意,需回到 spec |
| 規則 V 擋所有 `UPDATE *_cents`,所以 hold 表頭不能是帶金額欄的 `orders` 列 | 金額只能 INSERT 一次 | data-model 寫成不變條件;表怎麼拆是 Day 22 |
