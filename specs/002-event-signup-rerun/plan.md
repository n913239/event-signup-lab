# Implementation Plan: 活動報名系統(完整功能)

**Branch**: `001-event-signup-full`(未建分支,`.specify/feature.json` 指向此目錄) | **Date**: 2026-09-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-event-signup-full/spec.md`

> **這份 plan 描述的是 repo 現況,不是待建的設計。** `src/`、`tests/`、`schema.sql`、`openapi.yaml`、`web/`、`ios/`
> 都已經有實作;本次 `/speckit-plan` 沒有改任何程式碼與 `docs/`。技術棧由使用者鎖死,不在本文件討論替代方案。
> 與 spec 不一致之處標 ⚠️,留給 `/speckit-tasks` 或作者處理。
>
> **測試現況沒有在本次重跑**(本 session 沒有執行 `vitest` / `check:all` 的權限)。
> 最近一次紀錄見 commit `ec550fa`:「228/228 綠、check:all 與 self-test 通過、swift build 過」。

## Summary

單一組織的活動報名 API + web + iOS 骨架。核心是「售票的規則」:10×10 座位、限量票種、有時效的保留、
逾時自動釋放、確認後出票並凍結金額快照,不收錢。

技術做法(現況):
- **併發**全部落在 D1(SQLite)的約束與條件式寫入:部分唯一索引 `ux_seat_active` 防重座、
  `CHECK (remaining >= 0)` 擋超賣、`db.batch()` 的整批回滾做全有全無;確認以 `WHERE … expires_at > ?` + `changes` 判勝負。
- **時間**由 `src/app.js` 的中介層取一次(`createApp({ now })`,測試注入假時鐘),`src/domain/` 只收參數。
- **金額**全程整數分;擇優折扣在 `src/domain/money.js`;分 → 元只在三個允許位置。
- **契約**只有一份 `openapi.yaml`:API 以 `tests/contract.test.js` 對它驗回應;iOS 以 swift-openapi-generator 產生 client;
  web 手寫呼叫(見 ⚠️ C-2)。

## Technical Context

**Language/Version**: JavaScript(ES modules)on Cloudflare Workers(`compatibility_date = 2026-09-01`);Swift 6.0 tools(iOS 17 / macOS 14)

**Primary Dependencies**:
- API:Hono ^4.10.3;wrangler ^4.128(開發與測試用的 miniflare D1)
- web:Vite ^8.3、Tailwind CSS v4(`@tailwindcss/vite` ^4.3.3)、daisyUI ^5.7.46、`qrcode` ^1.5.4
- iOS:swift-openapi-generator ≥ 1.6.0(build plugin)、swift-openapi-runtime ≥ 1.7.0、swift-openapi-urlsession ≥ 1.0.2、SwiftUI

**Storage**: Cloudflare D1(SQLite),`schema.sql`,全部表 `STRICT`;時間 INTEGER epoch 毫秒;金額 INTEGER 分(`*_cents`)

**Testing**:
- vitest ^3.2.4,`fileParallelism: false`;`tests/helpers/db.js` 用 `getPlatformProxy` 拿真的 miniflare D1(不用 shim)
- 併發測試用 `tests/helpers/gate.js` 閘門(不用隨機延遲);時間用 `tests/helpers/clock.js` 假時鐘
- 契約:`tests/contract.test.js`(ajv 2020 驗每一條 operation 的回應)
- 靜態裁判:`scripts/check-*.sh` 五支 + `scripts/self-test.sh`(證明每支都抓得到、也不誤報)
- iOS:`swift build`(沒有 XCTest);web:沒有自動化測試

**Target Platform**: Cloudflare Workers(API,含 Cron Trigger `*/5 * * * *`)、Cloudflare Pages(web)、iOS 17(不上架,非目標 1)

**Project Type**: web-service + web 前端 + iOS 骨架,同一個 repo

**Performance Goals**: 無(非目標 14:除非免費額度真的爆)。唯一要量的是 SC-009「我的票券」一次載入的 `rows_read`,只記數字

**Constraints**: 單一組織;每活動固定 100 席;一次保留 ≤ 10 席;對外操作 18 項;web 5 個畫面;只做繁中;金額路徑零浮點;
`src/domain/` 不取現在時間;併發判斷在 SQL 的 `WHERE`;簽章比對常數時間;訂單金額快照不可變

**Scale/Scope**: 單一組織、學習用規模;每活動 100 席;8 張表(`members`、`refresh_tokens`、`events`、`ticket_types`、
`seat_holds`、`orders`、`order_items`、`promo_codes`)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

依 `.specify/memory/constitution.md` v2.0.0 的五條硬規則逐條檢查現況設計。規則本身不改;有張力就標 ⚠️。

### Gate I — 金額一律用整數最小單位 → **PASS,附 ⚠️ G1-a**

| 檢查 | 現況 | 結果 |
|---|---|---|
| 儲存 | 所有金額欄 `INTEGER`、欄名 `_cents`,`STRICT` 表 | ✅ |
| 契約 | `openapi.yaml` 的 `Cents` 為 integer;時間 `EpochMs` int64 | ✅ |
| 計算 | `src/domain/money.js`:`applyPct = Math.floor((c * (100 - pct) + 50) / 100)`,擇優用嚴格 `<` | ✅ |
| 顯示轉換位置 | 只有 `src/presentation/money.js`、`web/src/lib/money.js`、`ios/.../Tickets/Money.swift` | ✅ |
| 裁判 | `check-money.sh` 掃 `src`(排除 presentation)、`web/src`(排除 money.js)、iOS(排除 Money.swift) | ✅ |

- ⚠️ **G1-a iOS 千分位依裝置 locale**:`Money.swift` 用 `NumberFormatter(.decimal)` 產千分位,分隔符號隨裝置語系而變;
  web 固定用逗號。不違反規則 I(全程整數),但牽動 SC-008「web 與 iOS 顯示同一份資料」與 spec Q39「NT$1,000」。
  兩支格式化函式都沒有測試(`tests/presentation/money.test.js` 測的是伺服器端 `centsToDisplay`)。

### Gate II — 時間是參數,不是副作用 → **PASS,附 ⚠️ G2-a**

| 檢查 | 現況 | 結果 |
|---|---|---|
| `src/domain/` | `money.js`、`states.js`、`time-rules.js`、`validate.js` 都不取時間;`canHold(e, now)`、`isHoldExpired(h, now)` | ✅ |
| 取時間的地方 | `src/app.js` 中介層 `c.set('now', now())`;`src/worker.js` 的 `scheduled` 用 `Date.now()` | ✅ |
| 可注入 | `createApp({ now })`;測試用假時鐘測 `now == opens_at`、`now == expires_at` 等邊界 | ✅ |
| 裁判 | `check-time-injection.sh` 只掃 `src/domain` | ✅ |

- ⚠️ **G2-a 取時間的位置與規則字面**:規則寫「取現在時間是 `routes` / `worker` 的責任」;現況的主要取點在 `src/app.js`
  (組裝 routes 的中介層),不在 `src/routes/`。語意上等同 routes 層、而且是單一注入點,本 plan 視為符合;
  但字面上 `app.js` 兩者都不是,由作者判斷要不要在規則裡寫明。
- 補充:`src/lib/db/*` 的 SQL 以參數收 `now`(例如 `expires_at > ?`),沒有 `CURRENT_TIMESTAMP` / `unixepoch()`。

### Gate III — 併發判斷必須在 SQL 的 `WHERE` 裡 → **PASS(裁判通過),附 ⚠️ G3-a、G3-b**

| 寫入 | 條件 / 防線 | 結果 |
|---|---|---|
| 搶座(`holds.createHold`) | 部分唯一索引 `ux_seat_active`(`WHERE status IN ('holding','confirmed')`)+ 裸 `INSERT`,撞到 → `seat_taken` | ✅ |
| 一人一活動一個 hold | 部分唯一索引 `ux_member_holding`(`status='holding' AND seq=0`)→ `hold_exists` | ✅ |
| 逾時釋放 | 同一 batch 先 `UPDATE … SET status='expired' WHERE … AND expires_at <= ?` 再 INSERT | ✅ |
| 確認(`orders.insertConfirmed`) | `UPDATE seat_holds … WHERE status='holding' AND expires_at > ?`;`INSERT orders … WHERE changes() = n`;回傳看 `changes` | ✅ |
| 放棄 / 取消 / 截止 / 鎖定 / refresh 輪替 | 條件式 `UPDATE … WHERE status = …` / `revoked_at IS NULL` 並檢查 `changes` | ✅ |
| 新增票種 | `INSERT … SELECT … WHERE SUM(capacity) + ? <= 100`,看 `changes`;trigger 當第二道 | ✅ |
| 裁判 | `check-concurrency.sh`:每個 UPDATE 有 WHERE、檔案有看 `changes` | ✅ |

- ⚠️ **G3-a 扣名額的第一道是 `CHECK`,不是 `WHERE`**:`createHold` 的 `UPDATE ticket_types SET remaining = remaining - ? WHERE id = ? AND event_id = ?`
  沒有 `AND remaining >= ?`,超賣由 `CHECK (remaining >= 0)` 拋錯、整批回滾。
  規則 III 寫「條件式寫入 + 檢查 `changes`,並用 `CHECK` 當**第二道**」;但原文 R6(作者 2026-09-27 定)明訂
  「扣到負數由 `CHECK (remaining >= 0)` 拋錯,整批回滾」—— 因為 `db.batch()` 只在拋錯時回滾,`changes = 0` 不會讓前面的座位 INSERT 撤銷。
  兩處說法有張力;`docs/spec.md` 決定 9 又寫「`UPDATE … WHERE remaining > 0` 是第二道」。現況照 R6。**由作者決定規則 III 的字面要不要納入這個例外。**
- ⚠️ **G3-b 改名額的第一道是應用層先查**:`PATCH /events/:id` 在 `src/routes/events.js` 先讀票種、算「已售」與總和再寫;
  SQL 端 `UPDATE ticket_types SET remaining = remaining + (? - capacity), capacity = ? WHERE id = ? AND event_id = ?` 沒有已售條件,
  靠 `CHECK (remaining >= 0)` 與 `trg_ticket_types_sum_update` trigger 當第二道(T082 補,併發 PATCH + POST 有測試)。
  結果正確(第二道擋得住),但「先查」這一步正是規則 III 字面禁止的形式。`check-concurrency.sh` 抓不到(它只看 WHERE 存在與 `changes`)。

### Gate IV — 簽章比對必須是常數時間 → **PASS,附 ⚠️ G4-a、G4-b**

| 比對 | 現況 | 結果 |
|---|---|---|
| JWT(HS256) | `src/lib/jwt.js` 用 `crypto.subtle.verify('HMAC', …)`;拒 `alg` ≠ HS256 | ✅ |
| 票券 QR | `src/lib/hmac.js` 只簽不驗(非目標 13;`verifyQrPayload` 已於 `ec550fa` 刪除) | ✅ |
| 密碼 | `src/lib/password.js`:PBKDF2-SHA256 100k,`crypto.subtle.timingSafeEqual`(Node 測試環境退回 XOR 迴圈) | ✅ |
| 裁判 | `check-jwt-timing.sh`(雙向、多變數名、`localeCompare`);JWT 邊界另由 `tests/jwt.test.js` 六個測試裁定 | ✅ |

- ⚠️ **G4-a 規則兩種說法**:constitution / `CLAUDE.md` 寫「常數時間」,`docs/spec.md` 硬性約束 4 寫「用 `crypto.subtle.verify`」。
  密碼比對用的是 `timingSafeEqual`,符合前者、不符合後者的字面(constitution 的「建議新增」已指出這個不一致,未處理)。
- ⚠️ **G4-b refresh token 以雜湊查表**:refresh token 不是簽章,DB 存 SHA-256,以 `WHERE token_hash = ?` 查;
  比對發生在 SQLite 索引查找,不是常數時間。不在規則 IV「簽章比對」的字面範圍內,記下供作者確認範圍。

### Gate V — 確認後的訂單金額不可變 → **PASS**

| 檢查 | 現況 | 結果 |
|---|---|---|
| 快照 | `order_items.unit_price_cents`(確認當下票價);`orders` 存 `subtotal/early_bird_pct/group_pct/promo_cents/total_cents` | ✅ |
| 不可變 | 金額欄只在 `insertConfirmed` 的 `INSERT` 寫入;之後只 `UPDATE orders SET status` | ✅ |
| 讀取 | `SELECT_ORDER` JOIN `ticket_types` 只取 `name`,金額讀 `order_items` 自己的 `_cents` | ✅ |
| 裁判 | `check-price-snapshot.sh`(UPDATE / REPLACE / UPSERT 三通道)+ `tests/schema.test.js` ⑥ | ✅ |

### 使用者指定的約束(非 constitution)

- ⚠️ **C-1 第 19 條 endpoint**:`openapi.yaml` 與 `src/app.js` 有 `GET /health`,不在原文 18 條內(spec FR-001、SC-011:「對外操作 = 18」)。
  它是營運用探針,不是業務操作;但 `CLAUDE.md`「不要主動加 endpoint」—— 算不算,由作者決定。
- ⚠️ **C-2「三端共用一份 openapi.yaml」**:
  - iOS 用的是**副本** `ios/EventSignup/Sources/EventSignup/openapi.yaml`(generator plugin 要求檔案在 target 內),靠 `scripts/sync-openapi.sh` 手動同步;
    本次檢查兩份內容相同,但沒有任何測試或 CI 保證它們不分岔。
  - web 的 `web/src/api.js` 是手寫呼叫,不是從契約產生,也沒有契約測試。
- ⚠️ **C-3 契約與 spec 不一致**:`openapi.yaml:296` `seat_nos` 的 `maxItems: 100`,spec FR-041 / H1 是 10(程式碼擋在 10)。

### Gate 結論

五條硬規則**全部通過**,沒有需要在 Complexity Tracking 辯護的違規。⚠️ 共 8 項(G1-a、G2-a、G3-a、G3-b、G4-a、G4-b、C-1、C-2)
加一項契約錯誤(C-3),都是「規則字面 vs 作者定的做法」或「現況與 spec 的落差」,依指示不自行改規則、不改程式碼。

### Phase 1 設計後重新檢查

Phase 1 產出(data-model、contracts、quickstart)只描述現況,沒有引入新的表、欄位、endpoint 或寫入路徑 → 結論不變,仍為 **PASS + 上列 ⚠️**。

## Project Structure

### Documentation (this feature)

```text
specs/001-event-signup-full/
├── spec.md              # /speckit-specify + /speckit-clarify
├── spec-writeback.md    # clarify 產出,給作者回寫 docs/spec.md
├── plan.md              # 本檔
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── README.md        # Phase 1:指向根目錄 openapi.yaml(唯一契約),列錯誤代碼與已知落差
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2(/speckit-tasks 產生,本次不建)
```

### Source Code (repository root)

```text
openapi.yaml             # 唯一契約(API / iOS / 契約測試共用)
schema.sql               # D1 schema(STRICT、部分唯一索引、trigger)
seed.sql
wrangler.toml            # D1 binding、Cron */5、CORS_ORIGIN

src/
├── worker.js            # fetch + scheduled(sweepExpired)
├── app.js               # createApp({ now }):唯一的請求時間取點、CORS、錯誤形狀
├── domain/              # 純邏輯,無 I/O,時間從參數進
│   ├── money.js         # 擇優折扣、applyPct
│   ├── states.js        # 狀態機轉移
│   ├── time-rules.js    # canHold、isHoldExpired、isEarlyBird
│   └── validate.js      # 所有輸入驗證
├── lib/
│   ├── jwt.js           # HS256,crypto.subtle.verify
│   ├── hmac.js          # 票券 QR 簽章(只簽)
│   ├── password.js      # PBKDF2 + 常數時間比對
│   └── db/              # 每張表一個模組;條件式寫入 + changes
├── routes/              # Hono handler:auth、events、ticket-types、holds、orders、_auth(requireMember/Staff/Owner)
└── presentation/        # API 側唯一允許分 → 元的地方

tests/
├── domain/  lib/  presentation/  routes/
├── concurrency.test.js  # 閘門重現超賣、重座、三方競態
├── contract.test.js     # 對 openapi.yaml 驗回應
├── jwt.test.js          # 規則 IV 的六個測試
├── schema.test.js       # 含 ⑥(order_items 有自己的 _cents)
├── worker.test.js       # sweepExpired
└── helpers/             # db(miniflare D1)、gate、clock、world、auth

scripts/                 # check-*.sh 五支裁判、self-test.sh、sync-openapi.sh、race.sh、smoke.sh …

web/                     # Cloudflare Pages:Vite + Tailwind v4 + daisyUI v5
└── src/
    ├── main.js          # 五個路由:login、events、event、hold、tickets
    ├── api.js           # bearer、401 自動 refresh 一次、x-server-now 校時
    ├── lib/             # money.js(web 唯一分 → 元)、clock.js、countdown.js
    └── pages/           # login、events、event(10×10)、hold(倒數/套用/放棄)、tickets(QR/取消)

ios/
├── App/                 # Xcode 專案(project.yml)
└── EventSignup/         # Swift package,generator plugin
    └── Sources/EventSignup/
        ├── openapi.yaml             # ⚠️ 根目錄的副本(sync-openapi.sh)
        ├── Auth/  Events/  Tickets/  Cache/(OrdersCache:票券離線讀取)
        └── Tickets/Money.swift      # iOS 唯一分 → 元
```

**Structure Decision**:單一 repo、三個交付物。API 在根目錄(`src/` + `schema.sql` + `wrangler.toml`),web 在 `web/`,iOS 在 `ios/`;
三者以根目錄 `openapi.yaml` 為唯一契約。沒有 `backend/`、`frontend/` 分層,因為 API 就是根專案(`package.json` 在根目錄)。

## 現況與 spec 的落差(交給 `/speckit-tasks`)

| # | spec | 現況 | 備註 |
|---|---|---|---|
| D-1 | Q11 / FR-085:0 元票種 + 存在但無效的碼 → 409 | 忽略、201(`holds.js` 的 `blocks` 用 `<`,`0 < 0` 為假) | 【待作者確認】 |
| D-2 | Q26 / FR-025:`mine` 只算自己保留中 | 自己已確認的座位也是 `mine`(`events.js` `seatMap`) | 【待作者確認】 |
| D-3 | FR-041:最多 10 席 | 程式 10、契約 `maxItems: 100` | C-3 |
| D-4 | SC-009:量 `rows_read` 並記錄 | 沒有任何量測紀錄 | — |
| D-5 | SC-008:web 與 iOS 顯示一致 | iOS 千分位依 locale | G1-a |
| D-6 | FR-023 Q24:是否由排程轉 `finished` | 沒有排程 | 【待作者確認】 |
| D-7 | clarify 查核列出的「只實作、沒測試」行為 | 見 `spec-writeback.md` 各列 repo 欄 | 補測試,不改行為 |
| D-8 | iOS 活動列表 | 固定只查 `status=on_sale` | spec 沒要求列其他狀態,記下 |

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

沒有違規需要辯護。上列 ⚠️ 屬於規則字面與作者既定做法之間的張力,依指示不改規則,交由作者判斷。
