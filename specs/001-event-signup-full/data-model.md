# Data Model(Phase 1)

**Feature**: 001-event-signup-full · **Date**: 2026-09-14

> ⚠️ **這不是 schema。** schema 是 Day 22 的實驗對象,作者手寫,AI 版另存。
> 本檔只寫「有哪些實體、哪些不變條件、哪些狀態轉換」—— 跟 `tests/schema.test.js` 一樣,
> 寫的是**它必須擋得住什麼**,不是它長什麼樣。表怎麼拆、欄位叫什麼、時間存 INTEGER 還是 TEXT,都是作者的自由,
> 只要通過 `npm run test:schema`(8 組)與 `/check-schema`(8 條)。
>
> 唯一的命名約束來自裁判:金額欄 `*_cents`(規則 I / `check-money`、`check-price-snapshot` 靠這個認欄位);
> 表名落在 `members / events / ticket_types / seat_holds / orders / order_items / refresh_tokens / promo_codes`(schema.test ⑦)。

## 實體

### Member 成員
| 欄位(語意) | 約束 |
|---|---|
| id | |
| email | **唯一**,識別鍵(C15) |
| password_hash | PBKDF2 字串(R2),不存明文 |
| nickname | 非空 |
| role | `member` \| `staff`,CHECK;**只由 SQL 改**(通用做法 1) |
| created_at | |
| failed_logins | 連續登入失敗次數,成功歸零(L1,2026-09-27) |
| locked_until | 鎖到何時(epoch 毫秒);NULL = 沒鎖 |

### RefreshToken
| 欄位 | 約束 |
|---|---|
| token_hash | SHA-256(原值),**不存原值**;唯一 |
| member_id | → Member |
| expires_at | 簽發 + 30 天(C16) |
| revoked_at | NULL = 有效 |

不變條件:`/auth/refresh` 成功 ⇒ 舊列 `revoked_at` 非 NULL 且新列存在,同一交易。重放(拿已撤銷的 hash 來換)⇒ 該 `member_id` 全部列 `revoked_at` 填上(C17)。

### Event 活動
| 欄位 | 約束 |
|---|---|
| id | |
| owner_id | → Member,建立者,**role 必為 staff**(C4);主辦 = owner |
| name | 非空 |
| opens_at, deadline_at | `opens_at < deadline_at` |
| status | `draft` \| `on_sale` \| `closed` \| `finished`,CHECK;**沒有 `cancelled`**(C14) |
| group_min_qty | 預設 4,≥ 2(C6) |
| group_pct | 預設 10,0–100 整數(C6) |
| hold_ttl_minutes | 預設 10,**5–30**(C19) |
| created_at | |

座位:**固定 10×10 = 100 席**,`seat_no` ∈ `A1…J10`;不存座位表,座位狀態由 SeatHold 推導(C3、C5)。

### TicketType 票種
| 欄位 | 約束 |
|---|---|
| id | |
| event_id | → Event |
| name | 非空 |
| price_cents | 整數 ≥ 0;**可改**(`PATCH /ticket-types/:id`),改了不影響既有訂單 |
| capacity | 名額;同活動 Σ capacity ≤ 100(C3);改到 < 已售 → 拒(C13) |
| remaining | 剩餘;`CHECK (remaining >= 0)`(超賣第二道防線);`remaining ≤ capacity` |
| early_bird_until | 時間;`now < early_bird_until` 即早鳥(通用做法 5) |
| early_bird_pct | 0–100 整數(C7);0 = 沒有早鳥 |

> `capacity` / `remaining` 是語意名;作者可以只存一個並算另一個,但 `CHECK (remaining >= 0)` 這個字面是 schema.test ⑤ 認的。

### SeatHold 座位保留(hold 的最小單位是「一個座位」)
| 欄位 | 約束 |
|---|---|
| id | |
| hold_id / 分組鍵 | 同一次 `POST /holds` 的 N 個座位共用;`DELETE /holds/:id`、`POST /holds/:id/confirm` 用它 |
| event_id, seat_no | **部分唯一索引** `(event_id, seat_no) WHERE status IN ('holding','confirmed')`(schema.test ④,述詞必含 `confirmed`) |
| ticket_type_id | 每個座位一個票種(C3);同一 hold 內全部相同(spec Assumptions 的解讀) |
| member_id | |
| status | `holding` \| `confirmed` \| `expired` \| `cancelled`,CHECK |
| expires_at | 建立時 now + `hold_ttl_minutes`(FR-031) |
| created_at | |

不變條件:
- 同一 `(member_id, event_id)` 最多一個 `status = 'holding'`(通用做法 6)。這條**也**要能在 SQL 層擋(部分唯一索引 `(member_id, event_id) WHERE status='holding'` 是最直接的做法;或條件式 INSERT)。
- **過期列不刪**(FR-035)。
- `holding` 且 `expires_at <= now` 的列**視同不存在**,但索引不會自己放,搶位的那次操作要先翻成 `expired`(R6 事實 4)。
- 訂單 `cancelled` ⇒ 對應 SeatHold 全部 `cancelled`,座位離開索引述詞,可再售(C11)。
- **hold 階段不寫任何金額**(C10 + 規則 V)。

### Order 訂單(確認時才誕生)
| 欄位 | 約束 |
|---|---|
| id | |
| member_id, event_id | |
| hold_id | → 對應的 SeatHold 群 |
| status | `confirmed` \| `checked_in` \| `cancelled`,CHECK(`holding` / `expired` 若作者把 hold 表頭與訂單合併,才會出現在這張表) |
| subtotal_cents, early_bird_pct, group_pct, promo_cents, total_cents | **全部在 INSERT 時寫,之後不得 UPDATE**(規則 V / `check-price-snapshot`) |
| promo_code | 用了哪個碼(可 NULL);「每人每活動一次」靠 `(member_id, event_id, promo_code)` 查已存在的非 cancelled 訂單 —— 或作者另建使用紀錄,不另開表 |
| confirmed_at | |

### OrderItem 明細(一座一列)
| 欄位 | 約束 |
|---|---|
| order_id, seat_no, ticket_type_id | |
| unit_price_cents | **快照**:確認當下的票種價格(C10);schema.test ⑥ 要求此欄存在 |

不變條件:Σ `unit_price_cents` = Order.`subtotal_cents`;訂單成立後任何 `PATCH /ticket-types` 不改變它。

### PromoCode 優惠碼
| 欄位 | 約束 |
|---|---|
| code | 唯一 |
| discount_cents | 整數 > 0(現金券,通用做法 4) |
| valid_until | 時間 |
| event_id | NULL = 全站 |

不變條件:確認時 `now < valid_until` 且(`event_id IS NULL` 或 = hold 的 event)且本人此活動未用過,否則 **409,不靜默忽略**(C8)。

## 狀態轉換

### Event
```
draft ──(SQL)──▶ on_sale ──(POST /close 或 now ≥ deadline_at 的判定)──▶ closed ──(排程 / SQL)──▶ finished
  ▲                                                                                        
  └── 只由 SQL 進出(通用做法 2)                       沒有 cancelled(C14)
```
`POST /events` 直接建成 `on_sale`。**`closed` 是狀態,`deadline_at` 是時間,兩個真相來源都要查**:
`canHold` 要求 `status = 'on_sale'` **且** `opens_at ≤ now < deadline_at`。

### SeatHold / Order(訂單那張圖的實體化)
```
holding ──confirm(本人,now < expires_at)──▶ confirmed ──(staff SQL)──▶ checked_in
  │  │                                          │
  │  └──expired(搶位翻狀態 / sweepExpired)         └──cancel(本人)──▶ cancelled(終態;座位釋放)
  └──cancelled(DELETE /holds/:id,本人)
```
| 從 | 到 | 誰 / 條件 | 座位 |
|---|---|---|---|
| holding | confirmed | 本人、`now < expires_at`、活動 `on_sale`(C13:closed 後既有 hold 仍可確認 → **此條件要放寬為「hold 建立時已通過」,確認時不再查活動狀態**,只查過期) | 保護延續(索引述詞含 confirmed) |
| holding | expired | 任何人的搶位 batch 第一句,或 sweep | 釋放 |
| holding | cancelled | 本人 `DELETE /holds/:id` | 釋放 |
| confirmed | cancelled | 本人 `POST /orders/:id/cancel` | 釋放(C11) |
| confirmed | checked_in | staff SQL(C14) | 保護 |
| checked_in | — | 不可取消(C12) | |
| cancelled / expired | — | 終態,任何轉換 → 409 | |

> ⚠️ 上表 confirm 那列標了一個 **plan 對 C13 的推論**:「提前截止後既有 hold 仍可確認」意味著 confirm 不能再查 `status = 'on_sale'`。
> 但 `deadline_at` 呢?hold 到期最長 30 分鐘,若 `deadline_at` 在這 30 分鐘內到,C13 的精神(不讓主辦動作弄掉別人的 hold)同樣適用 —— **confirm 只查 hold 自己的 `expires_at`**。這條要回寫 `docs/spec.md`(已加進 `spec-writeback.md` 第一節 C13 那列的注意事項)。

## 驗證規則(輸入層,`src/domain/validate.js`)

| 輸入 | 規則 |
|---|---|
| email | 有 `@`、≤ 254 字元、小寫正規化 |
| password | ≥ 8 字元(C15),無其他規則 |
| nickname | 1–50 字元 |
| event.name / ticket_type.name | 1–100 字元 |
| opens_at / deadline_at / early_bird_until / valid_until | 整數毫秒,`opens_at < deadline_at` |
| price_cents / discount_cents | 整數 ≥ 0(優惠碼 > 0) |
| capacity | 整數 ≥ 0;新增時 Σ ≤ 100 |
| group_min_qty / group_pct / early_bird_pct | 整數;min_qty ≥ 2;pct 0–100 |
| hold_ttl_minutes | 整數 5–30 |
| seat_nos | 非空陣列、去重後長度不變、每個符合 `^[A-J](10|[1-9])$`、長度 ≤ 100 |
| promo_code | 1–32 字元,大小寫不敏感(存大寫) |

## 讀取次數(SC-008)

`GET /orders`(我的票券)目標形狀:**一次查詢**(orders JOIN order_items JOIN events,以 member_id 篩)+ 零額外查詢;
`qr_payload` 在 presentation 層算,不查 DB。實作後用 `wrangler dev` 的 D1 log 或 `meta.rows_read` 記實際數字進 `docs/verified.md`。
