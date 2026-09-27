# 回寫清單:`/speckit-clarify` 2026-09-27 → `docs/spec.md`

> 這份給作者自己動手。`docs/` 一個字都沒有被改。
> 編號 Qn = `spec.md`「Clarifications」裡的題號(沿用使用者的 3–44)。
> 「repo 現況」一欄是 clarify 時對 `src/`、`tests/`、`openapi.yaml`、`web/`、`ios/` 的查核結果:
> **有測試** = 行為已實作且有測試釘住;**只實作** = 行為在但沒有測試;**不一致** = 答案與 code 不同。

## 一、必須先改:原文內部矛盾

### 1. 無效優惠碼 vs 平手規則(Q9)

- **位置**:`docs/spec.md`「折扣怎麼算」→「優惠碼」那一條(原文第 134 行)與「平手」那一條(第 136 行)。
- **矛盾**:平手時選優惠碼,所以無效碼與最佳候選同額時「它本來會被選中」→ 409;
  但同一句又寫「別的折扣本來就比較好**或一樣好** → 忽略這個碼」→ 訂單成立。同額時兩句結論相反。
- **作者 2026-09-27 的決定**:同額 → 忽略。
- **建議改寫**(取代原文第 134 行「無效…時:」之後的括號前半段):

  > 無效(不存在、過期、不屬於此活動、已用過)時:**假設它有效、會讓應付金額嚴格低於其他最佳折扣,
  > 或沒有任何別的折扣 → 409 `promo_rejected`;其他情況(別的折扣比較好或一樣好)→ 忽略這個碼,訂單照樣成立。**
  > 不存在的碼沒有面額:有別的折扣 → 忽略;沒有 → 409。

- **並在「平手」那一條補一句**:「平手順序只用在**有效**折扣之間。」
- **repo 現況**:有測試(`src/routes/holds.js:98`、`tests/routes/holds.test.js`)。

## 二、有 repo 不一致,要作者拍板

| Q | 答案 | repo 現況 | 要改哪邊 |
|---|---|---|---|
| Q11 | 0 元票種 + 無效碼 → 409(沒有別的折扣) | **不一致**:只有「不存在的碼」會 409;「存在但無效」的碼在小計 0 時 `0 < 0` 為假,被忽略、回 201。沒有 route 層測試 | 作者決定後,改 code 或改答案;再補進原文 M3 |
| Q26 | 座位狀態 `mine` = 自己**保留中**的 | **不一致**:`src/lib/db/events.js:66` 以 `member_id === viewerId` 判斷,自己**已確認**的座位也顯示 `mine`。只有「全部空位」的測試 | 同上;定案後寫進 API 表 `GET /events/:id` 的說明 |
| Q24 | 目前沒有自動轉 `finished` 的排程 | 只實作(靠「沒有」成立):Cron 只跑 `sweepExpired` | 原文狀態機下方寫「`finished` 由排程或 SQL」—— 若不做排程,改成「只由 SQL」;若要做,寫明觸發條件 |

## 三、建議補進原文的空白(答案已定、repo 已實作)

### 「必須被測試證明的規則」表(第 85–98 行)

- 第 2、3 條補相等邊界(Q3):「`opens_at ≤ now < deadline_at` 才能建 hold;`now == opens_at` 可以,`now == deadline_at` 不行」。有測試。
- 第 2 條補(Q4):「過了 `deadline_at` 不自動轉 `closed`;兩個來源各自擋,都回 409 `not_on_sale`」。有測試。

### 狀態機(第 72–83 行)

- 補(Q14):「改時間不影響 `status`;沒有 `closed → on_sale`」。只實作(`states.js` 有測試,PATCH 不改狀態沒有 route 測試)。

### API 表

| 條目 | 建議補的說明 | Q | repo |
|---|---|---|---|
| `POST /auth/register` | email 轉小寫存、唯一不分大小寫、只檢查含 @ 與長度 3–254;暱稱必填 1–50 字、不唯一;密碼 ≥ 8 無上限;重複 → 409 `email_taken` | Q17、Q18 | 有測試(`email_taken` 只實作;唯一不分大小寫只靠 app 轉小寫,DB 沒有 `NOCASE`) |
| `POST /auth/refresh` | 新 refresh 的 30 天從輪替當下起算;重放 → 401 `refresh_replayed` | Q19 | 只實作(30 天只測了登入發的那張) |
| `POST /auth/logout` | 撤銷只作用在 refresh;access token 無狀態,撤銷後仍可用到 15 分鐘到期 | Q16 | 只實作 |
| `POST /events` | `opens_at < deadline_at`、可以是過去時間;`group_min_qty ≥ 2`;`group_pct` 0–100;名稱 1–100 字 | Q22 | 有測試(過去的 `deadline_at` 未測) |
| `GET /events` | `?status` 可用 `draft/on_sale/closed/finished`,其他 → 400;只看 `status` 欄不看時間;預設含 `closed`、`finished` | Q25 | 只實作大半(drafts 與 `on_sale` 有測試) |
| `GET /events/:id` | 座位狀態 `free/held/sold/mine`;`held` 只算 `holding` 且 `expires_at > now`;別人的 draft → 404 | Q5、Q26、Q42 | 見第二節 Q26 |
| `PATCH /events/:id` | 可改 `name`、`opens_at`、`deadline_at`、`hold_ttl_minutes`、`group_min_qty`、`group_pct` 與 `ticket_types[].capacity`(一次可多個,全有全無:低於已售 → 409 `capacity_below_sold`、總和 > 100 → 409 `capacity_exceeded`) | Q27、Q28 | 有測試(總和 > 100 的錯誤代碼未測) |
| `POST /events/:id/close` | 對 `closed`/`finished`(含重複截止)→ 409 `terminal_state` | Q13 | 有測試(`finished` 未測) |
| `POST /events/:id/ticket-types` | `early_bird_until` 可省略;`early_bird_pct` 預設 0、0–100;`price_cents` 整數 ≥ 0;名額 0–100;任何活動狀態都可新增 | Q29、Q30 | 有測試(任何狀態可新增只實作) |
| `POST /events/:id/holds` | 空清單、超過 10 席、重複、編號不在 A–J × 1–10 → 400 `invalid_input`;票種不屬於此活動 → 404 | Q8、Q23 | 有測試(404 只實作)。**另:`openapi.yaml:296` 的 `seat_nos maxItems` 是 100,與 H1 的 10 席不符** |
| `DELETE /holds/:id` | 非 `holding` → 409 `terminal_state`;非本人 → 404;放棄後狀態為 `cancelled`,列留著 | Q6、Q31 | 404 有測試;409 只實作 |
| `POST /holds/:id/confirm` | H7 補:已確認一律回同一張訂單,不看 body 的碼、不看 `expires_at`;訂單已取消後再確認 → 409 `terminal_state` | Q7 | 部分測試(帶碼重送、過期後重送、取消後重送都未測) |
| `POST /holds/:id/quote` | 過期 → 409 `hold_expired`;已放棄或已確認 → 409 `terminal_state`;非本人 → 404;`promo_status` = `none/applied/not_better/invalid`;碼有效期看試算當下 | Q32、Q33 | 部分測試(錯誤代碼本身未斷言) |
| `GET /orders` | 列本人所有訂單(含 `cancelled`、`checked_in`),不含 hold;依 `confirmed_at` 新到舊 | Q34 | 只實作 |
| `GET /orders/:id` | 非本人亦非主辦 → 404;已取消的訂單仍回 `qr_payload` | Q35、Q42 | 404 與主辦可看有測試;已取消仍回 QR 只實作 |
| `POST /orders/:id/cancel` | 不受活動狀態或時間限制,只看是否 `confirmed`;非本人 → 404 | Q15、Q42 | 部分測試(截止後取消未測) |

### 「折扣怎麼算」

- 優惠碼補(Q12):「`now < valid_until` 才有效,相等即失效;碼不分大小寫(存大寫、比對前轉大寫)」。
  repo:部分測試(相等邊界未測;「存大寫」只是慣例,DB 沒有 CHECK)。

### 「保留與確認的商業規則」表

- L1 補(Q20、Q21):「計數對象是帳號;不存在的 email 不計數、回 401;鎖定到期後計數不歸零,再錯 1 次進下一階;
  成功登入計數與階梯都歸零;鎖定中不驗密碼」。有測試。
- 新增一列(Q31):「放棄、取消的紀錄一樣留著,只改 `status`」—— 目前原文只寫過期列不刪。只實作。

### 「規格層的決定」表

- 新增一列(Q43):「**登入鎖定狀態**:`members` 加 `failed_logins`、`locked_until` 兩欄」。
  這是 L1 需要的欄位,但原文決定表沒列 —— 依 CLAUDE.md「不要主動加欄位」,原文應該有這一條。有測試。
- 座位編號(Q23):第 9 條補「列 A–J、欄 1–10(A1 … J10)」。有測試。
- 座位釋放(Q5):「座位機制」段補「定期清理每 5 分鐘一次」。只實作(`wrangler.toml` 的 cron;頻率沒有測試)。

### 「前端」

- web(Q36、Q37):「主辦操作只透過 API,五個畫面不放主辦功能;保留倒數畫面有『放棄』;我的票券只對 `confirmed` 顯示『取消訂單』」。只實作,web 沒有測試。
- iOS(Q38):「活動列表只列活動,座位圖在點進去的明細畫面」。只實作。**另:iOS 活動列表固定只查 `status=on_sale`**,原文沒寫要不要列其他狀態。
- 顯示(Q39、Q40):「金額 NT$ 加千分位,整元不顯示小數,有分才顯示兩位;web 時間用瀏覽器時區、zh-TW 格式」。
  web 只實作(沒有測試)。**iOS 的千分位來自裝置 locale 的 `NumberFormatter`,不保證是逗號**,與 web 可能不一致(牽動「做完定義」的「web 與 iOS 顯示同一份資料」)。

### 「做完定義」表

- 第三列(Q44):「D1 讀取次數有算過」→「量 `GET /orders` 一次載入的 `rows_read`,記下數字,沒有目標值」。
  **repo 現況:沒有任何量測紀錄**;只有 `src/lib/db/orders.js:8` 的註解宣稱單一查詢、無 N+1。

### 錯誤代碼(Q41、Q42)

- 建議在 API 一節加一張錯誤代碼表(內容同 `spec.md` FR-090),並寫明:
  「僅本人」的資源對別人一律 404;主辦限定的寫入對非主辦 403;別人的 draft → 404;訂單明細例外,主辦可看。
- repo:`openapi.yaml` 的 `Error.error` enum 另有 `not_implemented`(沒有任何地方回傳)與 `internal`(500,沒列在任何操作的 responses)。
  要不要列進原文由作者決定。
