# 規格:活動報名系統

> 這份講**要做什麼**。刻意不含實驗設計與陷阱清單 ——
> 那些放在 repo 外(`iThome/2026-impl-spec.md` 第三節),
> 因為無菌室 session 會讀到這個 repo。

## 一句話

活動報名。限量名額、可選位、保留十分鐘、逾時自動釋放、確認後出票。不收錢。

## API

### 認證
| Method | Path | 說明 |
|---|---|---|
| `POST` | `/auth/register` | 建立成員(單一組織) |
| `POST` | `/auth/login` | access token(短)+ refresh token(長) |
| `POST` | `/auth/refresh` | 輪替,舊 refresh 立刻失效 |
| `POST` | `/auth/logout` | 撤銷當前 refresh |

### 活動
| Method | Path | 授權 | 說明 |
|---|---|---|---|
| `POST` | `/events` | staff | 名稱、開賣時間、截止時間、座位配置 |
| `GET` | `/events` | 成員 | 列表,可 `?status=on_sale` |
| `GET` | `/events/:id` | 成員 | 含票種、剩餘名額、座位狀態 |
| `PATCH` | `/events/:id` | 僅主辦 | 改名額 / 時間 |
| `POST` | `/events/:id/close` | 僅主辦 | 手動提前截止 |

### 票種
| Method | Path | 授權 | 說明 |
|---|---|---|---|
| `POST` | `/events/:id/ticket-types` | 僅主辦 | 名稱、價格、名額、早鳥條件 |
| `PATCH` | `/ticket-types/:id` | 僅主辦 | 改價格 |

### 保留與確認
| Method | Path | 授權 | 說明 |
|---|---|---|---|
| `POST` | `/events/:id/holds` | 成員 | 選位 + 保留(預設 10 分鐘) |
| `DELETE` | `/holds/:id` | 僅本人 | 主動放棄 |
| `POST` | `/holds/:id/confirm` | 僅本人 | 確認 → 建訂單 |

### 訂單
| Method | Path | 授權 | 說明 |
|---|---|---|---|
| `GET` | `/orders` | 成員 | 我的票券 |
| `GET` | `/orders/:id` | 本人或主辦 | 明細,含金額快照 |
| `POST` | `/orders/:id/cancel` | 僅本人 | 取消 |

合計 17 條。

## 狀態機

```
活動:  draft → on_sale → closed → finished
                  │          │
                  └─ cancelled ─┘

訂單:  holding → confirmed → checked_in
          │           │
          ├─ expired  └─ cancelled
          └─ cancelled
```

## 必須被測試證明的規則

| 規則 | 測試 |
|---|---|
| `on_sale` 之外不能建 hold | 對 `closed` 活動 `POST /holds` → 4xx |
| 過了 `deadline_at` 即使 `status` 仍是 `on_sale` 也不能報名 | 只推時間不改狀態 → 4xx |
| 未到 `opens_at` 不能報名 | 時間推到開賣前 → 4xx |
| `expired` 的 hold 不能 confirm | TTL 過期後 confirm → 4xx,且座位已釋放 |
| 確認後金額不可變 | 改票價 → 重讀訂單 → 金額不變 |
| 只有主辦能改活動 / 截止 / 改價 | 非主辦 → 403 |
| `cancelled` 是終態 | 從 `cancelled` 轉任何狀態 → 4xx |
| 不超賣 | 併發 N 次,售出數 ≤ 名額,且總數對得起來 |
| 座位不重複 | 併發搶同一座位,只有一個成功 |

> ⚠️ 第二、三條最容易漏:`status` 與 `opens_at`/`deadline_at` 是**兩個真相來源**,
> 兩個都要檢查,而且**每個邊界的測試分開寫**。

## 規格層的決定(2026-09-10 補,寫契約之前必須先有)

> 這一節原本是空白,而空白處會被實作者各自填掉 —— 那正是這個專案要示範的事。
> 以下七條**採通用做法**,寫下來就是為了讓「對」有定義。

| # | 決定 | 怎麼做 | 為什麼 |
|---|---|---|---|
| 1 | **角色** | `members.role` = `member` \| `staff`;**只能用 SQL 改**,沒有任何 endpoint 能設角色 | 非目標 11 已經寫了「管理後台用 `wrangler d1 execute` 直接下 SQL」 |
| 2 | **活動起始狀態** | `POST /events` 直接建成 `on_sale`;`draft` 只由 SQL 進出 | 沒有 publish endpoint,不為了狀態機完整而多開一條 |
| 3 | **`refresh_tokens` 建表** | 建。存 `token_hash`(不存原值)、`member_id`、`expires_at`、`revoked_at` | 要能**撤銷**與**偵測重放**就得存;不存的話 `/auth/refresh` 與 `/auth/logout` 沒有東西可測 |
| 4 | **`promo_codes` 建表** | 建,最小欄位:`code`、折扣值、`valid_until`、`event_id`(可為 NULL = 全站) | 折扣疊加需要第三層,寫死在程式裡就沒有資料可改 |
| 5 | **早鳥條件** | 用**截止時間** `ticket_types.early_bird_until`,`now < 該時間` 即符合 | 比「前 N 張」好測:不需要跟名額競爭,時間可注入 |
| 6 | **一人幾個 hold** | **一個活動一個**。已有有效 hold 時再 `POST /holds` → 4xx | 防囤位;也讓「同一人重複送出」不會污染超賣測試 |
| 7 | **座位釋放** | hold 過期後,**座位必須能被別人搶到**(行為要求;用什麼機制存放屬於 schema) | 這是行為契約,不是實作方式 |

### 折扣的套用順序(2026-09-10 定案)

三層折扣:**早鳥**(時間)、**團體**(數量)、**優惠碼**(輸入)。

**順序:早鳥 × 團體 → 再減優惠碼(先乘後減)。**

```js
// 全程整數分,不出現任何浮點數。折扣以「百分之幾」的整數表示。
const applyPct = (cents, pct) => Math.floor((cents * (100 - pct) + 50) / 100)

原價 100000 分、早鳥 10%、團體 10%、優惠碼 10000 分
applyPct(applyPct(100000, 10), 10) − 10000 = 81000 − 10000 = 71000 分(710 元)
```

優惠碼是**現金券**,不被百分比稀釋。

> ⚠️ **不要寫成 `cents * 0.9`。** 那是浮點乘法,而規則 1 叫「金額路徑零浮點」——
> `scripts/check-money.sh` 會擋。`+ 50` 是四捨五入(不是 `Math.round`,
> 那個吃的還是浮點);整個式子只有整數進出。
> 2026-09-10:規格原本寫 `round(1000 × 0.9 × 0.9)`,跟自己的硬規則 1 打架,
> 而唯一能通過檢查的寫法反而是浮點 —— 改掉了。

> 其他順序不是「錯」,是**不同的商業決定** —— 先減後乘會得到 729,
> 三個並聯扣原價會得到 700。**差 10 到 19 元,小到 code review 看不出來,
> 大到不變條件測試抓得到。** 寫在這裡就是為了讓「對」有定義。

### hold 的座位粒度(2026-09-10 定案)

**一個 hold 可以鎖多個座位**:`POST /events/:id/holds` 帶 `seat_nos: ["A1","A2"]`,
**全部成功或全部失敗**。團體折扣以 `seat_nos.length` 為依據。

> ⚠️ **要全有全無,就不能用 `ON CONFLICT DO NOTHING`。** 兩者二選一,實跑驗證過:
>
> | 寫法 | 結果 |
> |---|---|
> | 裸 `INSERT`,靠 UNIQUE 例外 | 第二個座位衝突 → **整批回滾**,第一個沒留下 ✅ |
> | `ON CONFLICT DO NOTHING` + 看 `changes` | 第二句 `changes=0` 但**不算失敗** → 整批照 commit,**第一個座位鎖住了** ❌ |
>
> **本專案採裸 `INSERT`**:`db.batch()` 裡逐筆 `INSERT INTO seat_holds …`,
> catch `SQLITE_CONSTRAINT` 回 409。單座的超賣判斷仍然用
> `UPDATE … WHERE remaining > 0` + 檢查 `changes`(那是另一件事)。

> 不用「使用者自己填同行人數」那種做法 —— 那是一個**沒有任何東西驗證它**的欄位,
> 放進一個主張「每條規則都要有裁判」的專案裡站不住。

### 座位釋放的機制(2026-09-10 定案)

`seat_holds` 用**部分唯一索引**,過期列留著不刪:

```sql
CREATE UNIQUE INDEX ux_seat_active
  ON seat_holds(event_id, seat_no)
  WHERE status IN ('holding','confirmed');
```

> ⚠️ **述詞一定要含 `confirmed`。** 只寫 `WHERE status='holding'` 的話,
> hold 一旦確認、狀態離開述詞,索引項就釋放了 —— **確認完成的那一刻,
> 座位反而失去保護**,別人搶得到。2026-09-10 用 SQLite 實跑驗證過這個行為。

過期列留著而不是刪掉,是為了**留下證據**:誰在什麼時候放掉了座位、
三方競態裡輸的那兩個是怎麼輸的。刪掉就查不出「過期被掃掉」與「從來沒存在」的差別。

> ⚠️ **索引不會自己過期。** 述詞看的是 `status`,不是 `expires_at` ——
> hold 過了 `expires_at` 但 `status` 還是 `holding` 時,**別人照樣搶不到**(實跑驗證)。
> 所以「逾時自動釋放」需要有人去翻那個 status:
>
> **搶位的那一批 SQL,第一句就是翻 status:**
>
> ```sql
> UPDATE seat_holds SET status = 'expired'
>  WHERE event_id = ? AND seat_no IN (…) AND status = 'holding' AND expires_at <= ?;
> -- 然後才 INSERT 新的 hold
> ```
>
> 這樣「釋放」與「搶到」在同一個 batch 裡,不需要背景排程也成立。
> 另外有一支 `sweepExpired(db, now)` 由 Cron Trigger 定期跑,
> 負責清掉沒有人來搶的過期 hold —— 它是三方競態裡的**第三方**。



## 硬性約束

1. 金額用整數最小單位;顯示轉換只在 `src/presentation/`
2. `src/domain/` 的時間一律從參數進來
3. 併發判斷寫在 SQL 的 `WHERE` 裡,不在應用層
4. 簽章比對用 `crypto.subtle.verify`
5. 訂單明細存價格快照

## 不做

見 `docs/non-goals.md`,15 條。
