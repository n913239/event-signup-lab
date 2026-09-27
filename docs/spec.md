# 規格:活動報名系統

> 這份講**要做什麼**。刻意不含實驗設計與陷阱清單 ——
> 那些放在 repo 外(鐵人賽工作區的 `spec/impl-spec.md` 第三節),
> 因為無菌室 session 會讀到這個 repo。

## 一句話

活動報名。限量名額、可選位、保留十分鐘(活動可設 5–30 分鐘)、逾時自動釋放、確認後出票。不收錢。

## 每個 Feature 的「做完」定義

**「使用者可以報名」沒有裁判資格** —— 什麼叫可以?跟到一半失敗算不算?
截止後還能跟算不算?所以每一條都要寫成能判定的句子:

| Feature | 做完 = |
|---|---|
| 活動與票種 | 只有主辦能改名額與時間;測試證明越權被拒 |
| **報名 / 選位 / 保留 / 確認** ⭐ | **併發測試通過(不超賣、不重座),且金額路徑零 `Double`,且保留逾時的三方競態有明確且被測試釘住的行為** |
| 我的票券與歷史 | web 與 iOS 對同一個 GET 顯示同一份資料,且 D1 讀取次數有算過 |

⭐ 那一列是整個專案的重心:一句話裡三個條件,而**沒有一個能靠讀 code 檢查**。

## API

### 認證
| Method | Path | 說明 |
|---|---|---|
| `POST` | `/auth/register` | 建立成員(單一組織):email(唯一)+ 密碼(≥ 8 字元)+ 暱稱;不做 email 驗證 |
| `POST` | `/auth/login` | access token 15 分鐘 + refresh token 30 天 |
| `POST` | `/auth/refresh` | 輪替,舊 refresh 立刻失效;**重放舊 refresh → 撤銷該成員全部 refresh,強制重新登入** |
| `POST` | `/auth/logout` | 撤銷當前 refresh |

### 活動
| Method | Path | 授權 | 說明 |
|---|---|---|---|
| `POST` | `/events` | staff | 名稱、開賣時間、截止時間、`group_min_qty`、`group_pct`、`hold_ttl_minutes`(座位固定 10×10) |
| `GET` | `/events` | 成員 | 列表,可 `?status=on_sale`;預設不含 `draft`,主辦看得到自己的 |
| `GET` | `/events/:id` | 成員 | 含票種、剩餘名額、座位狀態 |
| `PATCH` | `/events/:id` | 僅主辦 | 改名額 / 時間;名額 < 已售出 → 4xx |
| `POST` | `/events/:id/close` | 僅主辦 | 手動提前截止;只擋新 hold |

### 票種
| Method | Path | 授權 | 說明 |
|---|---|---|---|
| `POST` | `/events/:id/ticket-types` | 僅主辦 | 名稱、價格、名額、`early_bird_until`、`early_bird_pct`;名額總和 ≤ 100 |
| `PATCH` | `/ticket-types/:id` | 僅主辦 | 改價格 |

### 保留與確認
| Method | Path | 授權 | 說明 |
|---|---|---|---|
| `POST` | `/events/:id/holds` | 成員 | 票種 + `seat_nos` + 保留(活動設定的時長) |
| `DELETE` | `/holds/:id` | 僅本人 | 主動放棄 |
| `POST` | `/holds/:id/confirm` | 僅本人 | 確認 → 建訂單;body 可帶優惠碼;以確認當下票價計 |
| `POST` | `/holds/:id/quote` | 僅本人 | 試算:原價、套用哪種折扣、應付、優惠碼狀態;不建訂單、不用掉碼(2026-09-27 加,給「套用」按鈕) |

### 訂單
| Method | Path | 授權 | 說明 |
|---|---|---|---|
| `GET` | `/orders` | 成員 | 我的票券 |
| `GET` | `/orders/:id` | 本人或主辦 | 明細,含金額快照與票券 QR(訂單 id + HMAC,不含個資) |
| `POST` | `/orders/:id/cancel` | 僅本人 | 取消 `confirmed`,座位釋放;`checked_in` 不可 |

合計 18 條(2026-09-27 加試算;原規劃 17 條)。

## 前端

- **web(Cloudflare Pages + daisyUI)**:登入/註冊、活動列表、活動頁(10×10 選位)、保留倒數與確認、我的票券(含 QR)。五個畫面,沒有第六個。
- **iOS 骨架**:登入 + 活動列表(唯讀,含座位圖狀態)+ 我的票券列表與明細;client 從 OpenAPI 產生;不做選位;只做離線讀取快取(票券)。
- **票券 QR**:訂單 id + HMAC 簽章的短字串;不含任何個資;查驗端用同一把 key 驗(但本專案不做查驗端,非目標 13)。

## 狀態機

```
活動:  draft → on_sale → closed → finished

訂單:  holding → confirmed → checked_in(只由 staff 以 SQL 標記,不可取消)
          │           │
          ├─ expired  └─ cancelled
          └─ cancelled
```

`draft` 只由 SQL 進出;`finished` 由排程或 SQL —— 排程在 `deadline_at + hold_ttl_minutes` 之後把 `on_sale` / `closed` 轉 `finished`(`on_sale` 先 close 再 finish;2026-09-27 作者定);不做活動 `cancelled`。

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
| 提前截止不影響既有 hold | `closed` 後,截止前建立的 hold 在 `expires_at` 前 confirm → 201 |

JWT 邊界:由 repo 內 `tests/jwt.test.js` 六個測試 + `scripts/check-jwt-timing.sh` 裁定(2026-09-27 作者改定;原本的「七項清單放 repo 外」不再作為驗收)。

> ⚠️ 第二、三條最容易漏:`status` 與 `opens_at`/`deadline_at` 是**兩個真相來源**,
> 兩個都要檢查,而且**每個邊界的測試分開寫**。

## 規格層的決定(2026-09-10 補,寫契約之前必須先有)

> 這一節原本是空白,而空白處會被實作者各自填掉 —— 那正是這個專案要示範的事。
> 第 1–7 條**採通用做法**(2026-09-10),寫下來就是為了讓「對」有定義。
> 第 8–14 條是 2026-09-14 spec-kit clarify 標出的空白,由作者回答後回寫。

| # | 決定 | 怎麼做 | 為什麼 |
|---|---|---|---|
| 1 | **角色** | `members.role` = `member` \| `staff`;**只能用 SQL 改**,沒有任何 endpoint 能設角色 | 非目標 11 已經寫了「管理後台用 `wrangler d1 execute` 直接下 SQL」 |
| 2 | **活動起始狀態** | `POST /events` 直接建成 `on_sale`;`draft` 只由 SQL 進出 | 沒有 publish endpoint,不為了狀態機完整而多開一條 |
| 3 | **`refresh_tokens` 建表** | 建。存 `token_hash`(不存原值)、`member_id`、`expires_at`、`revoked_at` | 要能**撤銷**與**偵測重放**就得存;不存的話 `/auth/refresh` 與 `/auth/logout` 沒有東西可測。重放 → 撤銷該成員全部 refresh(以 `member_id` 批次設 `revoked_at`) |
| 4 | **`promo_codes` 建表** | 建,最小欄位:`code`、折扣值、`valid_until`、`event_id`(可為 NULL = 全站)。另需記錄每人每活動的使用紀錄(用在訂單上存 promo_code 即可,不必另開表) | 折扣疊加需要第三層,寫死在程式裡就沒有資料可改 |
| 5 | **早鳥條件** | 用**截止時間** `ticket_types.early_bird_until`,`now < 該時間` 即符合 | 比「前 N 張」好測:不需要跟名額競爭,時間可注入 |
| 6 | **一人幾個 hold** | **一個活動一個**。已有有效 hold 時再 `POST /holds` → 4xx | 防囤位;也讓「同一人重複送出」不會污染超賣測試 |
| 7 | **座位釋放** | hold 過期後,**座位必須能被別人搶到**(行為要求;用什麼機制存放屬於 schema) | 這是行為契約,不是實作方式 |
| 8 | **主辦** | `events.owner_id` = 建立該活動的 staff;其他 staff 對別人的活動一律 403 | 「僅主辦」與「staff」原本是兩個詞,現在有定義:staff 是角色,主辦是 owner |
| 9 | **座位與名額** | 固定 10×10 = 100 席 = 活動總容量;不做無座位活動;票種各有名額,總和 ≤ 100;hold 綁「座位 + 票種」,售出以座位為準,票種名額是第二道上限 | 座位唯一是第一道,`UPDATE … WHERE remaining > 0` 是第二道 |
| 10 | **hold 時長** | `events.hold_ttl_minutes`,預設 10,範圍 5–30,建活動時給 | 「預設 10 分鐘」原本沒說能不能改 |
| 11 | **`draft` 可見性** | 列表預設不含 `draft`;成員看不到;主辦看得到自己的 | 沒有 publish endpoint,所以 draft 只有 SQL 進出的人自己看得到 |
| 12 | **提前截止 / 改名額** | close 只擋新 hold,既有有效 hold 仍可在到期前確認 —— **confirm 不查活動 `status` / `deadline_at`,只查 hold 自己的 `expires_at`**;名額改到小於已售出 → 4xx | 不讓主辦一個操作就把別人手上的 hold 弄掉;confirm 若也查活動狀態,close 之後一定被擋,這條就是空話 |
| 13 | **取消訂單** | `confirmed` 可取消,座位釋放可再售;`checked_in` 不可取消 | 部分唯一索引述詞含 `confirmed`,取消時狀態離開述詞,座位自然釋放 |
| 14 | **`finished` / `checked_in`** | `finished` 由排程或 SQL;`checked_in` 由 staff 以 SQL 標記;**活動不做 `cancelled`** | 遵守非目標 11、13 |

### 折扣怎麼算(2026-09-27 作者改定:不疊加,擇優)

三種折扣:**早鳥**(時間)、**團體**(數量)、**優惠碼**(輸入)。**一筆訂單只套一種 —— 讓應付金額最低的那一種。**

- **早鳥**:`now < ticket_types.early_bird_until` 時,可以打 `ticket_types.early_bird_pct` %。
- **團體**:同一 hold 座位數 ≥ `events.group_min_qty`(預設 4)時,可以打 `events.group_pct`(預設 10)%。
- **優惠碼**:在 confirm 的 body 輸入,是現金券;同一碼可多人用,**每人每活動一次**。無效(不存在、過期、不屬於此活動、已用過)時:**它會讓應付更便宜(嚴格小於)、或沒有別的折扣 → 409 `promo_rejected`;別的折扣一樣便宜或更便宜 → 略過這個碼,訂單照樣成立**(2026-09-27 作者改定,取代原本的「一律 4xx」;同日把「它本來會被選中」改成「會讓應付更便宜」—— 前者在同額時會被平手順序選中,跟「一樣好就忽略」矛盾,spec-kit 重跑時抓到)。
- **擇優**:以整筆小計(各座票價加總,一個 hold 一個票種)分別算出三種候選,取應付金額最低的一種;都不符合就是小計。
- **平手**:依序選 **優惠碼 → 早鳥 → 團體**(固定順序,訂單明細可預測)。
- **優惠碼沒被選中**:不記在訂單上(`promo_code` 為 NULL、`promo_cents` 為 0),**碼不算用掉**,同一活動之後還能用。
- **優惠碼大於小計**:只折到 0;`promo_cents` 記**實際折抵**(= min(碼面額, 小計)),不是碼面額。
- **訂單只記被套用的那一種**:`early_bird_pct`、`group_pct`、`promo_cents` 三欄只有一欄非 0,看訂單就知道用了哪一種。
- **票價取確認當下**的票種價格;hold 不鎖價。改價後,既有訂單不變(快照),未確認的 hold 以新價計。

```js
// 全程整數分,不出現任何浮點數。折扣以「百分之幾」的整數表示。
const applyPct = (cents, pct) => Math.floor((cents * (100 - pct) + 50) / 100)

小計 100000 分、早鳥 10%、團體 10%(已達門檻)、優惠碼 10000 分
候選:優惠碼 90000、早鳥 90000、團體 90000 → 平手,選優惠碼 → 90000 分(900 元)
```

> ⚠️ **不要寫成 `cents * 0.9`。** 那是浮點乘法,而規則 1 叫「金額路徑零浮點」——
> `scripts/check-money.sh` 會擋。`+ 50` 是四捨五入(不是 `Math.round`,
> 那個吃的還是浮點);整個式子只有整數進出。

> 其他算法不是「錯」,是**不同的商業決定** —— 同一組輸入,疊加(先乘後減)是 710 元、
> 先減後乘是 729 元、擇優是 900 元。規格 2026-09-10 原本定的是疊加,
> 2026-09-27 作者改成擇優(多數電商的做法,客服講得清楚)。寫在這裡就是為了讓「對」有定義。

### 保留與確認的商業規則(2026-09-27 作者定)

| # | 規則 | 定案 |
|---|---|---|
| R6 | 名額不足時整批失敗的做法 | 一個 `db.batch()`:插座位列 → 扣名額;扣到負數由 `CHECK (remaining >= 0)` 拋錯,整批回滾 |
| 扣名額時機 | 名額什麼時候扣 | **建 hold 時扣**;放棄、過期、取消訂單時還回去 |
| 三方競態 | 到期那一刻(`now == expires_at`)原持有人確認、別人搶同座、sweep 同時發生 | **原持有人的確認一律輸**:到期就算過期(跟 `isHoldExpired` 一致) |
| 錯誤優先 | 座位衝突與名額不足同時發生 | 回 `seat_taken`(先檢查座位) |
| M1 | 早鳥看哪個時間點 | **看建立保留的時間**;寬限自然被保留時效(5–30 分鐘)限制住 |
| M2 | 取消的訂單用過的優惠碼 | 取消後可以在同一活動再用(只算有效訂單) |
| M3 | 0 元票種 | 允許,折扣不起作用 |
| M4 | 優惠碼有效期看哪個時間點 | 看確認的時間(碼是確認時輸入的) |
| H1 | 一次最多保留幾席 | **10 席**(防囤位) |
| H2 | 已買過同一活動能再買嗎 | 可以;限制的只是同時一個保留中 |
| H3 | 保留中可以改座位或票種嗎 | 不行,放棄後重新保留 |
| H4 | 放棄、過期、取消訂單時名額還不還 | 三種都還 |
| H5 | 主辦調降名額時,保留中的座位算不算已售 | 算:已售 = 名額 − 剩餘 |
| H6 | 主辦改保留時長影響已存在的保留嗎 | 只影響新的保留 |
| H7 | 同一個保留確認兩次 | 第二次回**同一張訂單**(200),不建第二張 |
| H8 | staff 能保留自己主辦的活動嗎 | 可以,staff 也是成員 |
| L1 | 登入失敗鎖定 | 連續錯 5 次開始鎖,5 → 10 → 20 → 40 → 60 分鐘(上限 1 小時),成功登入歸零;鎖定中一律 401 `unauthorized`,不透露被鎖、不累計嘗試 |

### hold 的座位粒度(2026-09-10 定案)

**一個 hold 可以鎖多個座位**:`POST /events/:id/holds` 帶 `seat_nos: ["A1","A2"]`,
**全部成功或全部失敗**。團體折扣以 `seat_nos.length` 為依據。
hold 帶票種;票種名額不足時整批失敗,與座位衝突同樣是 4xx。

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
