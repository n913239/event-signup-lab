# Feature Specification: 活動報名系統(完整功能)

**Feature Branch**: `001-event-signup-full`

**Created**: 2026-09-14

**Status**: Draft

**Input**: User description: "活動報名系統的完整功能,範圍以 docs/spec.md(17 條 endpoint —— 2026-09-27 加試算成 18 條、狀態機、七條「通用做法」決定、折扣順序)與 docs/non-goals.md 為準,一個字都不要擴張。這份 spec 要涵蓋後續十天要做完的全部:認證、活動與票種、保留/確認、訂單、web 前端(Cloudflare Pages)、iOS 骨架。原文沒寫清楚的地方用 [NEEDS CLARIFICATION] 標出來,不要自己決定;spec 用繁體中文。"

> **來源與邊界。** 本文件的內容範圍等於 `docs/spec.md` + `docs/non-goals.md`,
> 硬規則見 `.specify/memory/constitution.md`(照抄自 `CLAUDE.md`)。
> 原文沒寫清楚的 21 處,由作者於 2026-09-14 決定(見 Clarifications),原則是「選市場上最常見的做法」。
> 這 21 個決定已於 2026-09-27 回寫 `docs/spec.md`(依 `spec-writeback.md`);以 `docs/spec.md` 為唯一真相來源。

## 一句話

活動報名。限量名額、可選位、保留十分鐘、逾時自動釋放、確認後出票。不收錢。

## Clarifications

### Session 2026-09-14

- Q: web 前端的頁面範圍? → A: 登入/註冊、活動列表、活動頁(10×10 選位)、保留倒數與確認、我的票券(含 QR)。全部用 Pages + daisyUI。(C1)
- Q: iOS「骨架」的畫面範圍? → A: 登入 + 活動列表(唯讀,含座位圖狀態,不可點選)+ 我的票券列表與明細(各對同一個 GET);client 從 OpenAPI 產生;不做選位。(C2;2026-09-14 由兩畫面改為三畫面,對齊作者原施工表)
- Q: 票種名額、活動名額、座位數三者關係;hold 帶不帶票種? → A: 10×10 固定 100 席 = 活動總容量;票種各有名額,總和 ≤ 100;hold 綁「座位 + 票種」(每個座位一個票種);售出以座位為準,票種名額是第二道上限。(C3)
- Q: 「主辦」= 建活動的 staff,還是任何 staff? → A: 主辦 = 建立該活動的 staff(`events.owner_id`);其他 staff 對別人的活動一律 403。(C4)
- Q: 「座位配置」固定 10×10 還是可指定;有無無座位活動? → A: 固定 10×10;不做無座位活動。(C5)
- Q: 團體折扣門檻與百分比? → A: 同一 hold ≥ 4 座打 10%;數值存在活動上(`group_min_qty`、`group_pct`),建活動時給,預設 4 / 10。(C6)
- Q: 早鳥折扣百分比存哪、誰設? → A: 存在票種上(`ticket_types.early_bird_pct`),主辦建票種時設;`early_bird_until` 已有。(C7)
- Q: 優惠碼在哪一步輸入;可否重複用;不適用時拒絕還是忽略? → A: 在確認那一步輸入(confirm 的 body);同一個碼可多人用,每人每活動一次;不適用或過期 → 4xx 拒絕,不靜默忽略。(C8)
  - **2026-09-27 作者改定**:無效的碼只在「它本來會嚴格更便宜」或「沒有別的折扣」時 409;別的折扣一樣好或更好 → 忽略碼、訂單照樣成立。取消的訂單用過的碼可再用(M2)。
- Q: 多座 hold 的折扣是逐座還是總價? → A: 以整筆小計計算:早鳥與團體百分比套在小計上(先乘後減),優惠碼減總額一次;不逐座。(C9)
  - **2026-09-27 作者改定:折扣不疊加,擇優** —— 三種只套讓應付最低的一種,平手依序 優惠碼 → 早鳥 → 團體;仍以整筆小計計算、不逐座。
- Q: 改票價後,未確認的 hold 在確認時用哪個價? → A: 確認當下的票價(hold 不鎖價);改價前建的 hold 確認時以新價計。(C10)
- Q: 取消訂單後座位是否釋放? → A: 釋放、可再售。(C11)
- Q: `checked_in` 能否取消? → A: 不可取消。(C12)
- Q: 提前截止 / 改名額時既有 hold 的處理;名額改到小於已售出是否允許? → A: 提前截止只擋新 hold,既有有效 hold 仍可在到期前確認;名額改到小於已售出 → 4xx 拒絕。(C13)
- Q: `finished`、活動 `cancelled`、訂單 `checked_in` 的進入方式? → A: `finished` 由排程或 SQL;**不做活動 `cancelled` 狀態**;`checked_in` 由 staff 以 SQL 標記(遵守非目標 11,不開 endpoint)。(C14)
- Q: 註冊欄位、識別鍵、密碼規則? → A: email(唯一、識別鍵)+ 密碼(≥ 8 字元)+ 暱稱;不做 email 驗證。(C15)
- Q: access / refresh 效期? → A: access token 15 分鐘、refresh token 30 天。(C16)
- Q: refresh 重放偵測後的處置範圍? → A: 撤銷該成員全部 refresh token,強制重新登入。(C17)
- Q: 「JWT 七項邊界」內容不在 repo 內,是否納入驗收? → A: 納入驗收,但內容刻意放在 repo 外(實驗設計);spec 只寫「七項,由外部驗收清單裁定」,不展開。(C18)
- Q: hold 10 分鐘「預設」可否覆寫? → A: 可由活動設定 `hold_ttl_minutes`,預設 10,範圍 5–30。(C19)
- Q: 活動列表不帶篩選時是否含 `draft`;成員能否看到 `draft`? → A: 列表預設不含 `draft`;成員看不到 `draft`;主辦看得到自己的 `draft`。(C20)
- Q: 票券 QR 內容? → A: 訂單 id + HMAC 簽章的短字串,不含任何個資;查驗端用同一把 key 驗。(C21)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 報名:選位、保留、確認 (Priority: P1) ⭐

成員在開賣中的活動裡選一或多個座位並指定票種,系統替他保留(活動設定的時長,預設 10 分鐘);
保留期間內他確認(可附優惠碼),系統以確認當下的票價與折扣算出金額、建立訂單並出票;
逾時未確認,座位釋放,別人可以搶到。

**Why this priority**: 這是整個專案的重心。做完定義是「併發測試通過(不超賣、不重座),
且金額路徑零 `Double`,且保留逾時的三方競態有明確且被測試釘住的行為」——
一句話三個條件,沒有一個能靠讀 code 檢查。

**Independent Test**: 用測試帳號對一個 `on_sale` 活動建 hold、確認、讀回訂單;
併發 N 個成員搶同一活動 / 同一座位,驗證售出數 ≤ 名額、同一座位只有一人成功;
把時間推過保留到期點,驗證座位可被他人取得。

**Acceptance Scenarios**:

1. **Given** 活動 `on_sale`、時間在 `opens_at` 與 `deadline_at` 之間、座位 A1 A2 空、票種 T 尚有名額,
   **When** 成員送出 hold 帶票種 T 與 `seat_nos: ["A1","A2"]`,
   **Then** 兩個座位一起被保留,回傳 hold 與到期時間(now + 活動的 `hold_ttl_minutes`)。
2. **Given** A1 空、A2 已被別人保留,**When** 成員送出 hold 帶 `["A1","A2"]`,
   **Then** 整批失敗(4xx),A1 沒有被留下。
3. **Given** 票種 T 剩餘名額 1,**When** 成員送出 hold 帶票種 T 與兩個空座位,**Then** 4xx(票種名額是第二道上限)。
4. **Given** 成員在此活動已有一個有效 hold,**When** 再送一次 hold,**Then** 4xx。
5. **Given** 有效 hold,**When** 本人在到期前確認(不帶優惠碼),**Then** 建立訂單,
   金額 = 確認當下各座票價小計 → 套早鳥 % → 套團體 %(整數分),明細存價格快照。
6. **Given** 有效 hold 與對此活動有效的優惠碼,**When** 本人確認並帶該碼,**Then** 金額於百分比之後再減優惠碼面額一次。
7. **Given** 優惠碼過期、不適用此活動、或本人在此活動已用過,**When** 確認帶該碼,**Then** 4xx,不建訂單、不靜默忽略。
8. **Given** hold 建立後主辦改了票價,**When** 本人確認,**Then** 以新價計算(hold 不鎖價)。
9. **Given** hold 已過到期時間,**When** 本人確認,**Then** 4xx,且座位已釋放。
10. **Given** hold 已過到期時間,**When** 另一成員對同一座位送出 hold,
    **Then** 成功 —— 釋放與搶到在同一次操作內成立,不依賴背景排程。
11. **Given** 某座位有過期未被搶的 hold,**When** 定期清掃執行,**Then** 該 hold 變為 `expired`。
12. **Given** N 個成員同時對名額為 M 的票種建 hold 並確認(N > M),
    **Then** 成功數 ≤ M,且成功 + 失敗 = N。
13. **Given** N 個成員同時搶同一座位,**Then** 恰好一人成功。
14. **Given** 活動 `closed`,**When** 建 hold,**Then** 4xx。
15. **Given** 活動 `status` 仍為 `on_sale` 但時間已過 `deadline_at`,**When** 建 hold,**Then** 4xx。
16. **Given** 時間尚未到 `opens_at`,**When** 建 hold,**Then** 4xx。
17. **Given** 有效 hold,**When** 本人主動放棄,**Then** 座位釋放。
18. **Given** 有效 hold,**When** 非本人放棄或確認,**Then** 被拒。

---

### User Story 2 - 主辦建活動與票種、改名額 / 時間 / 價格、提前截止 (Priority: P2)

staff 建立活動(名稱、開賣時間、截止時間、團體折扣參數、hold 時長),座位固定 10×10 共 100 席,活動直接進 `on_sale`,
建立者成為主辦;主辦為活動加票種(名稱、價格、名額、早鳥截止與百分比),之後可以改名額、改時間、改價格、手動提前截止。
非主辦(含其他 staff)一律 403。

**Why this priority**: 沒有活動與票種就沒有東西可報名;做完定義是
「只有主辦能改名額與時間;測試證明越權被拒」。

**Independent Test**: 用 staff 帳號建活動與票種;用另一個成員帳號與另一個 staff 帳號分別嘗試 PATCH / close / 加票種 → 403。

**Acceptance Scenarios**:

1. **Given** 具 staff 角色的成員,**When** 建活動,**Then** 活動建立、狀態為 `on_sale`、主辦為建立者、座位 100 席。
2. **Given** 一般成員,**When** 建活動,**Then** 被拒。
3. **Given** 主辦,**When** 改名額 / 時間、加票種、改價格、提前截止,**Then** 成功。
4. **Given** 非主辦(含其他 staff),**When** 做同樣操作,**Then** 403。
5. **Given** 已有票種名額總和 90,**When** 主辦新增名額 20 的票種,**Then** 4xx(總和 ≤ 100)。
6. **Given** 票種已售出 30,**When** 主辦把該票種名額改為 20,**Then** 4xx。
7. **Given** 已有確認訂單的票種,**When** 主辦改價格,**Then** 既有訂單重讀金額不變。
8. **Given** 主辦提前截止,**Then** 活動狀態變 `closed`,之後建 hold → 4xx;截止前建立的有效 hold 仍可在到期前確認。
9. **Given** 建活動時 `hold_ttl_minutes` 給 3 或 31,**Then** 4xx(範圍 5–30);不給則為 10。

---

### User Story 3 - 成員註冊、登入、續期、登出 (Priority: P3)

成員以 email + 密碼 + 暱稱註冊(單一組織,不做 email 驗證)、登入取得 15 分鐘的 access token 與 30 天的 refresh token;
refresh 會輪替且舊 refresh 立刻失效;重放舊 refresh 會撤銷該成員全部 refresh;logout 撤銷當前 refresh。
角色只能用 SQL 改,沒有 endpoint。

**Why this priority**: 所有其他操作都需要身分;自製 JWT 就是題目本身(非目標 12)。

**Independent Test**: 註冊 → 登入 → 用 access 打受保護 endpoint → refresh → 舊 refresh 再用一次 → 被拒且新 refresh 也失效 → 重新登入 → logout → 該 refresh 被拒。

**Acceptance Scenarios**:

1. **Given** 未註冊的 email、≥ 8 字元密碼、暱稱,**When** 註冊,**Then** 建立成員,角色為 `member`。
2. **Given** 已存在的 email,**When** 註冊,**Then** 4xx。**Given** 密碼 7 字元,**Then** 4xx。
3. **Given** 已註冊成員,**When** 登入,**Then** 取得 access token(15 分鐘)與 refresh token(30 天)。
4. **Given** 有效 refresh,**When** refresh,**Then** 取得新的一組 token,舊 refresh 立刻失效。
5. **Given** 已被輪替掉的舊 refresh,**When** 再拿來 refresh,**Then** 被拒,且該成員所有 refresh token 一併撤銷,必須重新登入。
6. **Given** 已登入成員,**When** logout,**Then** 當前 refresh 被撤銷,再用 → 被拒。
7. **Given** 任何 endpoint,**When** 嘗試設定或改角色,**Then** 不存在這樣的 endpoint。
8. **Given** JWT 七項邊界的外部驗收清單,**When** 逐項執行,**Then** 七項全過(清單內容在 repo 外,由該清單裁定)。

---

### User Story 4 - 我的票券與歷史(web 與 iOS) (Priority: P4)

成員在 web(Cloudflare Pages + daisyUI)與 iOS 骨架上看到自己的票券與歷史;兩個前端對同一個 GET 顯示同一份資料。
web 另含登入/註冊、活動列表、活動頁(10×10 選位)、保留倒數與確認。
iOS 做登入、活動列表(唯讀)、票券列表 / 明細三個畫面,client 由 OpenAPI 產生,不做選位;只做離線讀取快取(**票券**),寫入一律要連線。
票券顯示 QR:訂單 id + HMAC 簽章的短字串,不含個資。

**Why this priority**: 做完定義是「web 與 iOS 對同一個 GET 顯示同一份資料,且 D1 讀取次數有算過」。
一份契約餵兩個前端 —— 契約錯的時候,兩邊各自都是對的。

**Independent Test**: 同一帳號在 web 與 iOS 各載入「活動列表」與「我的票券」,逐欄比對與 API 回傳一致;
記錄一次載入的資料庫讀取次數。

**Acceptance Scenarios**:

1. **Given** 成員有 N 張票,**When** 開「我的票券」,**Then** web 與 iOS 都列出同樣的 N 筆、同樣的欄位值。
1b. **Given** 有 M 場 `on_sale` 活動,**When** 開「活動列表」,**Then** web 與 iOS 都列出同樣的 M 場、同樣的欄位值;iOS 點進活動只看座位圖狀態,不能選位。
2. **Given** 成員開自己的訂單明細,**Then** 看得到金額快照與 QR。
3. **Given** 主辦開該活動任一訂單明細,**Then** 看得到;**Given** 非本人非主辦,**Then** 被拒。
4. **Given** iOS 曾成功載入,**When** 離線再開,**Then** 顯示快取的**票券**;活動列表需要連線;任何寫入操作要求連線。
5. **Given** web 活動頁,**When** 成員點選座位並送出,**Then** 進入保留倒數畫面,倒數歸零前可確認。
6. **Given** 一張票的 QR,**When** 用同一把 key 驗簽章,**Then** 得到訂單 id;QR 內容不含 email、暱稱或任何個資。

---

### User Story 5 - 取消訂單 (Priority: P5)

本人取消自己的 `confirmed` 訂單;座位釋放可再售;`cancelled` 是終態;`checked_in` 不可取消;退款金額不計算。

**Why this priority**: 狀態機完整性;「刻意保留的醜」明寫「退款金額不計算(狀態機有『已取消』,但不算錢)」。

**Independent Test**: 確認一筆訂單 → 取消 → 座位可被他人 hold → 再對該訂單做任何狀態轉換 → 4xx。

**Acceptance Scenarios**:

1. **Given** 本人的 `confirmed` 訂單,**When** 取消,**Then** 狀態變 `cancelled`,其座位釋放、可被他人 hold。
2. **Given** `cancelled` 訂單,**When** 轉任何狀態,**Then** 4xx。
3. **Given** 非本人,**When** 取消,**Then** 被拒。
4. **Given** `checked_in` 訂單,**When** 取消,**Then** 4xx。

---

### Edge Cases

以下每條都是 `docs/spec.md`「必須被測試證明的規則」、「規格層的決定」或本次 Clarifications 直接推出來的:

- `status` 與 `opens_at` / `deadline_at` 是**兩個真相來源**,兩個都要檢查,且每個邊界的測試分開寫:
  - `closed` 活動建 hold → 4xx
  - `status` 仍 `on_sale` 但過了 `deadline_at`(只推時間不改狀態)→ 4xx
  - 未到 `opens_at` → 4xx
- 保留逾時的三方競態:原持有人來確認、別人來搶、定期清掃 —— 三方同時到,行為要明確且被測試釘住。
- hold 過期後索引不會自己釋放:過了 `expires_at` 但狀態還是 `holding` 時,搶位的那次操作必須先翻過期狀態再佔位。
- 多座 hold 全有全無:第二個座位衝突時第一個不能留下;票種名額不足時整批不留。
- hold 一旦確認,座位仍受保護(確認完成那一刻不能反而被別人搶到)。
- 訂單取消後座位離開保護、可再售;`checked_in` 不可取消。
- 過期的 hold 紀錄留著不刪,要能分辨「過期被掃掉」與「從來沒存在」。
- 改票價後,既有確認訂單金額不變;尚未確認的 hold 在確認時以新價計。
- 提前截止只擋新 hold,既有有效 hold 仍可在到期前確認。
- 票種名額改到小於已售出 → 4xx;新增票種使名額總和 > 100 → 4xx。
- 優惠碼不適用(活動不符、過期、本人此活動已用過)→ 4xx,不靜默忽略。
- `hold_ttl_minutes` 超出 5–30 → 4xx。
- 活動 `finished` 只由排程或 SQL 進入;`draft` 只由 SQL 進出;訂單 `checked_in` 只由 SQL 標記 —— 三者都沒有 endpoint。
- refresh 重放:被拒之外,該成員全部 refresh 失效。

## Requirements *(mandatory)*

### Functional Requirements

#### 認證(4 條 endpoint)

- **FR-001**: 系統 MUST 提供註冊:email(唯一、識別鍵)+ 密碼(≥ 8 字元)+ 暱稱;建立單一組織內的成員,預設角色 `member`;不做 email 驗證。
- **FR-002**: 系統 MUST 提供登入,回傳 access token(效期 15 分鐘)與 refresh token(效期 30 天)。
- **FR-003**: 系統 MUST 提供 refresh:每次輪替發新的一組,舊 refresh 立刻失效;重放舊 refresh MUST 被偵測、拒絕,並撤銷該成員全部 refresh token(強制重新登入)。
- **FR-004**: 系統 MUST 提供 logout,撤銷當前 refresh;不帶 `refresh_token` → 400。
- **FR-008**: 登入 MUST 在連續失敗 5 次後鎖定 5 → 10 → 20 → 40 → 60 分鐘(上限 1 小時),成功歸零;鎖定中一律 401 `unauthorized`,不透露、不累計(L1)。(2026-09-27 回寫:作者改定,見 docs/spec.md)
- **FR-038**: 系統 MUST 提供 `POST /holds/:id/quote` 試算:回原價、套用的折扣、應付、`promo_status`(none / applied / not_better / invalid);不建訂單、不用掉碼;與確認共用同一套算法。(2026-09-27 回寫:作者改定,見 docs/spec.md)
- **FR-005**: refresh token MUST 以雜湊儲存,不存原值;MUST 記錄所屬成員、到期時間、撤銷時間。
- **FR-006**: 角色(`member` | `staff`)MUST 只能用 SQL 改;系統 MUST NOT 提供任何設定角色的 endpoint。
- **FR-007**: 簽章驗證 MUST 是常數時間比對(硬規則 IV)。「JWT 七項邊界」MUST 納入驗收;七項內容刻意放在 repo 外,由外部驗收清單裁定,本 spec 不展開。

#### 活動(5 條 endpoint)

- **FR-010**: staff MUST 能建立活動:名稱、開賣時間、截止時間、`group_min_qty`(預設 4)、`group_pct`(預設 10)、`hold_ttl_minutes`(預設 10,範圍 5–30);座位固定 10×10 共 100 席 = 活動總容量,不做無座位活動;建立後狀態直接為 `on_sale`,建立者記為主辦(`owner_id`)。
- **FR-011**: 成員 MUST 能列出活動,可用 `?status=on_sale` 篩選;預設不含 `draft`;一般成員看不到 `draft`,主辦看得到自己的 `draft`。
- **FR-012**: 成員 MUST 能讀單一活動:含票種、剩餘名額、座位狀態。
- **FR-013**: 僅主辦 MUST 能改活動名額與時間;名額改到小於已售出 → 4xx。
- **FR-014**: 僅主辦 MUST 能手動提前截止,活動狀態轉 `closed`;只擋新 hold,既有有效 hold 仍可在到期前確認。
- **FR-015**: 活動狀態機 MUST 為 `draft → on_sale → closed → finished`;`draft` 只由 SQL 進出;`finished` 只由排程或 SQL 進入;**不做活動 `cancelled` 狀態**。
- **FR-016**: 「主辦」MUST 定義為建立該活動的 staff;其他 staff 對別人的活動 MUST 一律 403。

#### 票種(2 條 endpoint)

- **FR-020**: 僅主辦 MUST 能為活動新增票種:名稱、價格、名額、`early_bird_until`、`early_bird_pct`;活動內票種名額總和 MUST ≤ 100,超過 → 4xx。
- **FR-021**: 僅主辦 MUST 能改票種價格。
- **FR-022**: 早鳥條件 MUST 用截止時間 `early_bird_until` 表示;**建立 hold 的時間** < 該時間即符合早鳥(M1,寬限由 hold 時效限制),套用該票種的 `early_bird_pct`。(2026-09-27 回寫:作者改定,見 docs/spec.md)
- **FR-023**: hold MUST 綁「座位 + 票種」:每個座位對應一個票種;售出以座位為準(座位唯一是第一道),票種名額是第二道上限。

#### 保留與確認(3 條 endpoint)

- **FR-030**: 成員 MUST 能對 `on_sale` 且在 `opens_at` ≤ now < `deadline_at` 的活動建立 hold,
  帶票種與 `seat_nos` 陣列,一次最多 10 席(H1),全部成功或全部失敗(座位衝突或票種名額不足都算失敗;兩者同時 → `seat_taken`)。名額在建 hold 時扣,放棄、過期、取消訂單時還回去(H4)。(2026-09-27 回寫:作者改定,見 docs/spec.md)
- **FR-031**: hold 到期時間 MUST = 建立時間 + 活動的 `hold_ttl_minutes`(預設 10,範圍 5–30)。
- **FR-032**: 同一成員在同一活動 MUST 只能有一個有效 hold;已有時再建 → 4xx。
- **FR-033**: hold 過期後,座位 MUST 能被別人搶到;釋放與搶到 MUST 在同一次搶位操作內成立,不依賴背景排程。
- **FR-034**: 系統 MUST 另有定期清掃,把沒有人來搶的過期 hold 標為 `expired`。
- **FR-035**: 過期 hold 紀錄 MUST 留著不刪。
- **FR-036**: 僅本人 MUST 能主動放棄 hold。
- **FR-037**: 僅本人 MUST 能確認 hold;確認 MUST 建立訂單;過期的 hold MUST NOT 能確認;確認 request body MAY 帶優惠碼。
- **FR-038**: 座位保護 MUST 同時涵蓋 `holding` 與 `confirmed` 兩種狀態;訂單 `cancelled` 後座位 MUST 離開保護。
- **FR-039**: 併發判斷(名額、座位唯一)MUST 在資料層的條件式寫入裡裁決,不在應用層先查再寫(硬規則 III)。

#### 訂單(3 條 endpoint)

- **FR-040**: 成員 MUST 能列出自己的票券。
- **FR-041**: 本人或主辦 MUST 能讀訂單明細,含金額快照與票券 QR。
- **FR-042**: 僅本人 MUST 能取消 `confirmed` 訂單;取消後座位釋放、可再售;`cancelled` 為終態,從 `cancelled` 轉任何狀態 → 4xx;`checked_in` MUST NOT 能取消。
- **FR-043**: hold(座位)狀態 MUST 為 `holding → confirmed | expired | cancelled`,`confirmed → cancelled`;訂單狀態 MUST 為 `confirmed → checked_in | cancelled`;`checked_in` 只由 staff 以 SQL 標記,沒有 endpoint。同一個 hold 確認兩次 → 回同一張訂單(H7)。(2026-09-27 回寫:作者改定,見 docs/spec.md)
- **FR-044**: 確認後訂單金額 MUST 不可變;明細 MUST 存價格快照,不靠票種 JOIN 即時算(硬規則 V)。
- **FR-045**: 退款金額 MUST NOT 計算(刻意保留的醜)。
- **FR-046**: 票券 QR MUST 為「訂單 id + HMAC 簽章」的短字串,MUST NOT 含任何個資;查驗端用同一把 key 驗。

#### 金額與折扣

- **FR-050**: 金額 MUST 一律用整數最小單位(分);顯示轉換只在 presentation 層(硬規則 I)。
- **FR-051**: 折扣 MUST 為三層:早鳥(時間)、團體(數量)、優惠碼(輸入)。
- **FR-052**: 三種折扣 MUST **不疊加,只套讓應付最低的一種**;平手依序 優惠碼 → 早鳥 → 團體。百分比以整數表示,
  計算為 `floor((cents × (100 − pct) + 50) / 100)`;優惠碼是現金券,直接減整數分,最多折到 0,訂單記實際折抵。
  範例:小計 100000 分、早鳥 10%、團體 10%(已達門檻)、優惠碼 10000 分 → 三個候選都是 90000 分,平手選優惠碼 → 90000 分。(2026-09-27 回寫:作者改定,見 docs/spec.md)
- **FR-053**: 折扣 MUST 以整筆小計計算,不逐座:小計 = 各座位票種現價加總;三個候選(早鳥 %、團體 %、優惠碼)都從小計算起,取最低。訂單只記被套用的那一種(其餘記 0)。(2026-09-27 回寫:作者改定,見 docs/spec.md)
- **FR-054**: 團體折扣 MUST 以 hold 的 `seat_nos.length` 為依據:座位數 ≥ 活動的 `group_min_qty` 時套 `group_pct`。
- **FR-055**: 票價 MUST 取確認當下的票種價格;hold 不鎖價。
- **FR-056**: 優惠碼 MUST 有:`code`、折扣值(整數分)、`valid_until`、`event_id`(可為 NULL = 全站);
  同一個碼可多人用,每人每活動 MUST 只能用一次(只算有效訂單,取消後可再用,M2);有效期看確認時間(M4)。
  無效(不適用該活動、過期、已用過、不存在)時:它本來會嚴格更便宜、或沒有別的折扣 → 409;別的折扣一樣好或更好 → 忽略碼,訂單照樣成立。(2026-09-27 回寫:作者改定,見 docs/spec.md)

#### web 前端(Cloudflare Pages)

- **FR-060**: web MUST 含五個畫面:登入/註冊、活動列表、活動頁(10×10 選位)、保留倒數與確認、我的票券(含 QR)。
- **FR-061**: web 的「我的票券與歷史」MUST 與 API 同一個 GET 回傳的資料一致。
- **FR-062**: 票券 MUST 顯示 QR;MUST NOT 做掃描端與核銷。
- **FR-063**: 只做繁中;UI 用 daisyUI 系統元件即可,不追求精緻度與完整 a11y。

#### iOS 骨架

- **FR-070**: iOS MUST 含三個畫面:登入、活動列表(唯讀,含座位圖狀態)、我的票券列表與明細;活動與票券資料各與 web 對同一個 GET 顯示同一份。
- **FR-071**: iOS client MUST 從 OpenAPI 契約產生;MUST NOT 做選位。
- **FR-072**: iOS MUST 只做**票券**的離線讀取快取;寫入一律要連線;MUST NOT 做離線編輯與衝突合併。
- **FR-073**: MUST NOT 上架 App Store / TestFlight;MUST NOT 做 APNs 推播(改用清單 + 拉取)。

#### 通用

- **FR-080**: 領域邏輯的「現在時間」MUST 從參數傳入;取現在時間是路由 / worker 的責任(硬規則 II)。
- **FR-081**: 錯誤訊息不友善(API 只回代碼)、沒有 log 聚合 —— 刻意保留的醜,MUST NOT 主動補。**2026-09-27 作者改定**:登入失敗鎖定(L1,見 FR-008);web 端把錯誤代碼翻成中文顯示(作者要求的 UX,API 仍只回代碼);其餘端點仍沒有限速。

### Key Entities *(include if feature involves data)*

原文提過的欄位 + 本次 Clarifications 新增的欄位(後者以 ★ 標記,回寫時要加進 `docs/spec.md`):

- **成員(member)**:email(唯一、識別鍵)★、密碼雜湊 ★、暱稱 ★;`role` = `member` | `staff`,只能用 SQL 改。連續登入失敗次數與鎖到何時(L1,2026-09-27)。
- **refresh token**:`token_hash`(不存原值)、`member_id`、`expires_at`(30 天)、`revoked_at`。
- **活動(event)**:名稱、`opens_at`、`deadline_at`、`owner_id` ★、`group_min_qty` ★(預設 4)、`group_pct` ★(預設 10)、
  `hold_ttl_minutes` ★(預設 10,5–30)、狀態(`draft` / `on_sale` / `closed` / `finished`);座位固定 10×10 = 100 席。
- **票種(ticket type)**:屬於一個活動;名稱、價格(整數分)、名額、`early_bird_until`、`early_bird_pct` ★;同活動名額總和 ≤ 100。
- **座位保留(hold / seat_holds)**:成員 × 活動 × 票種 × 多個 `seat_no`;到期時間;狀態
  `holding` / `confirmed` / `expired` / `cancelled`;過期列留著不刪。
- **訂單(order)**:由 hold 確認產生;金額快照(整數分);明細含各座位價格快照;使用的優惠碼 ★;狀態見 FR-043;QR = 訂單 id + HMAC。
- **優惠碼(promo code)**:`code`、折扣值(現金,整數分)、`valid_until`、`event_id`(可 NULL = 全站);每人每活動一次 ★。

## Success Criteria *(mandatory)*

### Measurable Outcomes

直接對應 `docs/spec.md` 的「做完定義」與「必須被測試證明的規則」:

- **SC-001**: 併發 N 次搶同一票種,售出數 ≤ 名額,且成功數 + 失敗數 = N;重跑 5 次結果一致。
- **SC-002**: 併發搶同一座位,恰好一人成功;重跑 5 次結果一致。
- **SC-003**: 金額路徑零浮點 —— `scripts/check-money.sh` 綠燈,且擇優範例算出 90000 分(不是疊加的 71000)。(2026-09-27 回寫:作者改定,見 docs/spec.md)
- **SC-004**: 保留逾時的三方競態(確認 / 搶位 / 清掃)有測試釘住行為,結果可重現;到期那一刻原持有人的確認一律輸(作者定)。
- **SC-005**: 狀態與時間邊界九條規則各有一條獨立測試且全過:
  `closed` 建 hold、過 `deadline_at`、未到 `opens_at`、過期 hold 確認、改價後金額不變、
  非主辦 403、`cancelled` 終態、不超賣、座位不重複。
- **SC-006**: 非主辦(含其他 staff)對活動 / 票種的每一條寫入操作都被拒(測試證明越權被拒)。
- **SC-007**: web 與 iOS 對「活動列表」與「我的票券」各自同一個 GET 顯示同一份資料(逐欄相同);以 `curl` 為第三方基準。
- **SC-008**: 「我的票券」一次載入的資料庫讀取次數有量測並記錄。
- **SC-009**: 舊 refresh 重放被拒且該成員全部 refresh 失效;logout 後的 refresh 被拒;JWT 七項邊界外部清單全過。
- **SC-010**: 五支靜態檢查(`check-money` / `check-time-injection` / `check-concurrency` /
  `check-jwt-timing` / `check-price-snapshot`)在完整實作上全部綠燈,`self-test.sh` 全過。
- **SC-011**: 優惠碼無效且它本來會被選中、或沒有別的折扣時 409;別的折扣一樣好或更好時忽略碼;同一人同一活動有效訂單已用過同一碼 → 視同無效。(2026-09-27 回寫:作者改定,見 docs/spec.md)

## 範圍邊界(非目標,不可協商)

以下 15 條 SHALL NOT 做,出自 `docs/non-goals.md`,列在這裡是為了讓計畫與任務階段有東西可對照:

1. 上架 App Store / TestFlight
2. APNs 推播(改用清單 + 拉取)
3. 線上金流 / 實際付款(只記帳,不收錢)
4. 真實場館座位圖(只做 10×10 方格)
5. 多租戶(只做單一組織)
6. 即時聊天 / WebSocket
7. Android
8. 離線編輯 / 衝突合併(只做離線讀取快取)
9. 圖片上傳(海報用文字 + 純色)
10. 國際化(只做繁中)
11. 管理後台(用 SQL 直接操作)
12. SSO / OAuth 第三方登入
13. 驗票掃碼入場(票券顯示 QR,不做掃描端與核銷)
14. 效能優化(除非免費額度真的爆)
15. UI 精緻度 / 完整 a11y

不做的架構:微服務、Redis / Upstash、Durable Objects、ELK、Nginx / Dubbo。
判準:每一個中介軟體都必須為一條「測試能裁決的規則」而存在。

## Assumptions

本節放原文明寫的前提,以及本 spec 對作者決定的**唯一一處解讀**(已標明):

- 單一組織,所有成員屬同一組織(非目標 5)。
- 不收錢,金額只記帳(非目標 3);退款金額不計算。
- 座位為 10×10 方格 = 100 席(非目標 4、C5)。
- 角色與 `draft` 狀態只由 SQL 進出(通用做法 1、2);`finished`、`checked_in` 同樣沒有 endpoint(C14)。
- 早鳥用截止時間而非「前 N 張」(通用做法 5)。
- 一人一活動一個有效 hold(通用做法 6)。
- 一個 hold 可鎖多座,全有全無;團體折扣以座位數計(hold 粒度定案)。
- 折扣:~~早鳥 × 團體 → 減優惠碼~~ → 2026-09-27 作者改定為**不疊加、擇優**,整數運算。
- **解讀(C3 + C9)**:C3 說「hold 綁座位 + 票種(每個座位一個票種)」,C9 說「早鳥 % 套在小計上」。
  若一個 hold 可混多個票種,而各票種 `early_bird_pct` 不同,「套在小計上」就沒有單一百分比可套。
  本 spec 因此採**一個 hold 一個票種、N 個座位**(每個座位都對應那一個票種)。
  這是唯一一處本 spec 自行收斂的解讀;**作者 2026-09-27 已確認**(docs/spec.md 寫明一個 hold 一個票種)。
- 依賴:schema、金額引擎與折扣順序、時間判定、併發是 `docs/EXPERIMENT-PROTOCOL.md` 的實驗對象,
  必須作者先手寫;骨架階段資料層只留介面。本 spec 不改變這個順序。
  **2026-09-27 改定**:作者只定規則與商業邏輯,程式碼由寫作 session 寫;AI 對照版照舊由乾淨 session 出(EXPERIMENT-PROTOCOL)。
