# Data Model: 活動報名系統(完整功能)

**Phase 1 output** · 2026-09-27 · 權威來源:根目錄 `schema.sql`(本文件描述它,不取代它)

慣例:全部表 `STRICT`;id 為 `TEXT`(應用層 `crypto.randomUUID()`);時間 `INTEGER` epoch 毫秒;金額 `INTEGER` 分,欄名 `*_cents`。

## 實體與欄位

### members — 成員(spec:成員)

| 欄位 | 型別 / 約束 | 來源 |
|---|---|---|
| `id` | TEXT PK | |
| `email` | TEXT NOT NULL UNIQUE | FR-010;應用層先轉小寫(DB 沒有 `NOCASE`) |
| `password_hash` | TEXT NOT NULL | `pbkdf2$100000$<salt>$<hash>` |
| `nickname` | TEXT,`length BETWEEN 1 AND 50` | Q18 |
| `role` | `member` \| `staff`,預設 `member` | FR-016;只能用 SQL 改 |
| `created_at` | INTEGER | |
| `failed_logins` | INTEGER ≥ 0,預設 0 | FR-015、Q43 |
| `locked_until` | INTEGER NULL | FR-015、Q43 |

### refresh_tokens — 續期憑證

| 欄位 | 型別 / 約束 |
|---|---|
| `token_hash` | TEXT PK(SHA-256 hex,不存原值) |
| `member_id` | FK → members |
| `expires_at` | INTEGER(發出時 + 30 天;輪替時自當下重算) |
| `revoked_at` | INTEGER NULL |

索引:`member_id`(重放時批次撤銷)、`expires_at`。

### events — 活動

| 欄位 | 型別 / 約束 | 來源 |
|---|---|---|
| `id` | TEXT PK | |
| `owner_id` | FK → members(建立者 = 主辦) | FR-017 |
| `name` | `length BETWEEN 1 AND 100` | Q22 |
| `opens_at`、`deadline_at` | INTEGER,`CHECK (opens_at < deadline_at)` | Q22 |
| `status` | `draft` \| `on_sale` \| `closed` \| `finished`,預設 `on_sale` | FR-022、FR-023 |
| `group_min_qty` | ≥ 2,預設 4 | Q22 |
| `group_pct` | 0–100,預設 10 | Q22 |
| `hold_ttl_minutes` | 5–30,預設 10 | FR-020 |
| `created_at` | INTEGER | |

座位不存表:固定 `A1 … J10`(`src/lib/db/events.js` 的 `SEAT_NOS`),狀態由 `seat_holds` 推導。

### ticket_types — 票種

| 欄位 | 型別 / 約束 | 來源 |
|---|---|---|
| `id` | TEXT PK | |
| `event_id` | FK → events;`UNIQUE (event_id, name)` | |
| `name` | `length BETWEEN 1 AND 100` | |
| `price_cents` | ≥ 0(可改;確認時取當下值) | FR-031、FR-032 |
| `capacity` | ≥ 0(應用層限 0–100) | Q29 |
| `remaining` | ≥ 0,`remaining <= capacity` | FR-045 |
| `early_bird_until` | INTEGER NULL(NULL = 沒有早鳥) | Q29 |
| `early_bird_pct` | 0–100,預設 0 | Q29 |

跨列約束:`trg_ticket_types_sum_insert` / `trg_ticket_types_sum_update` —— 同一活動 `SUM(capacity) > 100` 時 `RAISE(ABORT, 'capacity_exceeded')`。

### seat_holds — 座位保留(hold 的實體)

| 欄位 | 型別 / 約束 |
|---|---|
| `id` | TEXT PK(每座位一列) |
| `hold_id` | TEXT(同一 hold 的座位共用) |
| `seq` | ≥ 0;每個 hold 恰一列 `seq = 0` |
| `event_id`、`ticket_type_id`、`member_id` | FK |
| `seat_no` | CHECK:`[A-J][1-9]` 或 `[A-J]10` |
| `status` | `holding` \| `confirmed` \| `expired` \| `cancelled` |
| `expires_at`、`created_at` | INTEGER |

索引:
- `ux_seat_active` UNIQUE `(event_id, seat_no) WHERE status IN ('holding','confirmed')` —— 不重座(FR-046)
- `ux_member_holding` UNIQUE `(member_id, event_id) WHERE status = 'holding' AND seq = 0` —— 一人一活動一個保留(FR-042)
- `hold_id`、`(event_id, status)`、`(member_id, event_id)`、`expires_at`

「一個 hold」= 同 `hold_id` 的列;hold 的屬性(票種、到期、狀態)在各列相同。

### orders — 訂單(金額快照)

| 欄位 | 型別 / 約束 | 來源 |
|---|---|---|
| `id` | TEXT PK | |
| `member_id`、`event_id` | FK | |
| `hold_id` | TEXT UNIQUE(一個 hold 最多一張訂單,H7) | FR-062 |
| `status` | `confirmed` \| `checked_in` \| `cancelled` | FR-064 |
| `subtotal_cents` | ≥ 0 | FR-081 |
| `early_bird_pct`、`group_pct` | 0–100 | FR-088 |
| `promo_cents` | ≥ 0,預設 0(實際折抵) | FR-087 |
| `total_cents` | ≥ 0 | |
| `promo_code` | TEXT NULL(只有被套用時才記) | FR-088 |
| `confirmed_at` | INTEGER | FR-071 排序 |

`ux_orders_member_event_promo` UNIQUE `(member_id, event_id, promo_code) WHERE promo_code IS NOT NULL AND status IN ('confirmed','checked_in')` ——
每人每活動一次、只算有效訂單(FR-084、M2)。

### order_items — 訂單明細(價格快照)

| 欄位 | 型別 / 約束 |
|---|---|
| `order_id` | FK;PK `(order_id, seat_no)` |
| `seat_no` | TEXT |
| `ticket_type_id` | FK(只用來顯示名稱) |
| `unit_price_cents` | ≥ 0,確認當下票價 |

### promo_codes — 優惠碼

| 欄位 | 型別 / 約束 |
|---|---|
| `code` | TEXT PK(慣例存大寫;DB 沒有強制) |
| `discount_cents` | > 0(現金券) |
| `valid_until` | INTEGER(`now < valid_until` 才有效) |
| `event_id` | FK NULL(NULL = 全站) |

使用紀錄不另開表,以 `orders.promo_code` 表示(原文決定 4)。

## 關係

```
members 1 ─ * refresh_tokens
members 1 ─ * events (owner_id)
events  1 ─ * ticket_types
events  1 ─ * seat_holds * ─ 1 ticket_types
members 1 ─ * seat_holds
seat_holds (hold_id) 1 ─ 0..1 orders
orders  1 ─ * order_items
promo_codes * ─ 0..1 events
```

## 狀態轉移

### 活動(`src/domain/states.js`)

```
draft ──(SQL)──> on_sale ──close──> closed ──(SQL)──> finished
```

`TRANSITIONS.event`:`draft → on_sale`、`on_sale → closed`、`closed → finished`;沒有 `on_sale → finished` 的直達。

- 建立即 `on_sale`;`draft` 只由 SQL 進出;`finished` 只由 SQL(Q24【待作者確認】是否加排程)。
- 沒有 `closed → on_sale`;改時間不改狀態(Q14);過了 `deadline_at` 不自動轉 `closed`(Q4)。
- `close` 只對 `on_sale`:`UPDATE … WHERE status = 'on_sale'`,否則 409 `terminal_state`。

### 保留與訂單(`seat_holds.status` + `orders.status`)

```
seat_holds:  holding ──confirm──> confirmed ──(order cancel)──> cancelled
                │ ├──(expires_at ≤ now:搶位 / sweep)──> expired
                │ └──(DELETE 放棄)──> cancelled
orders:      confirmed ──> checked_in(只由 staff 以 SQL)
                 └──cancel──> cancelled(終態)
```

| 轉移 | SQL 條件(規則 III) | 名額 |
|---|---|---|
| 建立 | 裸 INSERT,撞 `ux_seat_active` / `ux_member_holding` | 扣(CHECK ≥ 0) |
| 確認 | `status='holding' AND expires_at > ?`,`changes = n` | 不動 |
| 放棄 | `status='holding' AND member_id = ?` | 還 |
| 過期 | `status='holding' AND expires_at <= ?` | 還 |
| 取消訂單 | `orders.status='confirmed' AND member_id = ?` | 還 |

## 驗證規則(`src/domain/validate.js`)

| 輸入 | 規則 | 錯誤 |
|---|---|---|
| 註冊 | email 含 @、3–254、轉小寫;密碼 ≥ 8;暱稱 1–50 | 400 `invalid_input` |
| 建活動 | 名稱 1–100;`opens_at < deadline_at`;`group_min_qty ≥ 2`;`group_pct` 0–100;`hold_ttl_minutes` 5–30 | 400 |
| 改活動 | 同上欄位子集 + `ticket_types[].{id, capacity 0–100}` | 400 |
| 票種 | `price_cents` 整數 ≥ 0;`capacity` 0–100;`early_bird_pct` 0–100;`early_bird_until` 可省略 | 400 |
| 保留 | `seat_nos` 1–10、不重複、符合 `[A-J](10|[1-9])`;`ticket_type_id` 必填 | 400 |
| 優惠碼 | 轉大寫 | 400 |

## 已知落差

- `seat_nos` 上限:程式 10、`openapi.yaml` `maxItems: 100`(plan C-3)。
- `seatMap` 的 `mine` 含自己已確認的座位(plan D-2,【待作者確認】)。
