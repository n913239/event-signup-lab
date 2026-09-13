# 回寫指引:21 個決定 → `docs/spec.md`

**日期**: 2026-09-14
**用途**: 作者自己回寫用。本檔只列「回寫到哪一節、怎麼寫」,**不動 `docs/` 底下任何檔**。
回寫完成後,`specs/001-event-signup-full/spec.md` 開頭那段「尚未回寫」的提示可以刪掉。

> 原則:`docs/spec.md` 是唯一真相來源(constitution Governance)。
> 下面的建議文字盡量沿用原文的表格與語氣;**★ 標的是會動到 schema 欄位或狀態機的決定**,
> 這幾條與 CLAUDE.md「不要主動加表、加欄位」有關 —— 這次是作者自己決定加的,不算 AI 主動加,但要在 commit message 寫明。

## 一、動到「規格層的決定」表的(建議直接加列,編號 8 起)

| 決定 | 加到哪 | 建議寫法 |
|---|---|---|
| C4 主辦定義 ★ | 「規格層的決定」表,新增第 8 列 | **主辦** \| `events.owner_id` = 建立該活動的 staff;其他 staff 對別人的活動一律 403 \| 「僅主辦」與「staff」原本是兩個詞,現在有定義:staff 是角色,主辦是 owner |
| C3 + C5 座位與名額 ★ | 同上,第 9 列 | **座位與名額** \| 固定 10×10 = 100 席 = 活動總容量;不做無座位活動;票種各有名額,總和 ≤ 100;hold 綁「座位 + 票種」,售出以座位為準,票種名額是第二道上限 \| 座位唯一是第一道,`UPDATE … WHERE remaining > 0` 是第二道 |
| C19 hold 時長 ★ | 同上,第 10 列 | **hold 時長** \| `events.hold_ttl_minutes`,預設 10,範圍 5–30,建活動時給 \| 「預設 10 分鐘」原本沒說能不能改 |
| C20 draft 可見性 | 同上,第 11 列 | **`draft` 可見性** \| 列表預設不含 `draft`;成員看不到;主辦看得到自己的 \| 沒有 publish endpoint,所以 draft 只有 SQL 進出的人自己看得到 |
| C13 截止與改名額 | 同上,第 12 列 | **提前截止 / 改名額** \| close 只擋新 hold,既有有效 hold 仍可在到期前確認;名額改到小於已售出 → 4xx \| 不讓主辦一個操作就把別人手上的 hold 弄掉 |
| C11 + C12 取消 | 同上,第 13 列 | **取消訂單** \| `confirmed` 可取消,座位釋放可再售;`checked_in` 不可取消 \| 部分唯一索引述詞含 `confirmed`,取消時狀態離開述詞,座位自然釋放 |
| C14 沒有 endpoint 的狀態 ★ | 同上,第 14 列 | **`finished` / `checked_in`** \| `finished` 由排程或 SQL;`checked_in` 由 staff 以 SQL 標記;**活動不做 `cancelled`** \| 遵守非目標 11、13 |

## 二、動到「API」表的

| 決定 | 加到哪 | 建議寫法 |
|---|---|---|
| C15 註冊欄位 | 「認證」表 `POST /auth/register` 說明欄 | 建立成員(單一組織):email(唯一)+ 密碼(≥ 8 字元)+ 暱稱;不做 email 驗證 |
| C16 效期 | `POST /auth/login` 說明欄 | access token 15 分鐘 + refresh token 30 天 |
| C17 重放處置 | `POST /auth/refresh` 說明欄 | 輪替,舊 refresh 立刻失效;**重放舊 refresh → 撤銷該成員全部 refresh,強制重新登入** |
| C10 + C20 | `POST /events` 說明欄 | 名稱、開賣時間、截止時間、`group_min_qty`、`group_pct`、`hold_ttl_minutes`(座位固定 10×10) —— 「座位配置」一詞拿掉 |
| C20 | `GET /events` 說明欄 | 列表,可 `?status=on_sale`;預設不含 `draft`,主辦看得到自己的 |
| C13 | `PATCH /events/:id` 說明欄 | 改名額 / 時間;名額 < 已售出 → 4xx |
| C13 | `POST /events/:id/close` 說明欄 | 手動提前截止;只擋新 hold |
| C7 | `POST /events/:id/ticket-types` 說明欄 | 名稱、價格、名額、`early_bird_until`、`early_bird_pct`;名額總和 ≤ 100 |
| C3 | `POST /events/:id/holds` 說明欄 | 票種 + `seat_nos` + 保留(活動設定的時長) |
| C8 + C10 | `POST /holds/:id/confirm` 說明欄 | 確認 → 建訂單;body 可帶優惠碼;以確認當下票價計 |
| C21 | `GET /orders/:id` 說明欄 | 明細,含金額快照與票券 QR(訂單 id + HMAC,不含個資) |
| C11 + C12 | `POST /orders/:id/cancel` 說明欄 | 取消 `confirmed`,座位釋放;`checked_in` 不可 |

## 三、動到「狀態機」的 ★

| 決定 | 怎麼改 |
|---|---|
| C14 | 活動那張圖拿掉 `cancelled` 分支,只剩 `draft → on_sale → closed → finished`;圖下加一行:「`draft` 只由 SQL 進出;`finished` 由排程或 SQL;不做活動 `cancelled`」 |
| C12 + C14 | 訂單那張圖:`checked_in` 旁註「只由 staff 以 SQL 標記,不可取消」 |

## 四、動到「折扣的套用順序」的

| 決定 | 怎麼改 |
|---|---|
| C6 ★ | 在「三層折扣」那句後面補:「團體:同一 hold 座位數 ≥ `events.group_min_qty`(預設 4)打 `events.group_pct`(預設 10)%」 |
| C7 ★ | 補:「早鳥:`now < ticket_types.early_bird_until` 時打 `ticket_types.early_bird_pct` %」 |
| C9 | 補一段:「**以整筆小計計算,不逐座**:小計 = 各座票價加總 → 早鳥 % → 團體 % → 減優惠碼一次。」範例 `100000` 可註明「小計」 |
| C10 | 補:「票價取**確認當下**的票種價格;hold 不鎖價。改價後,既有訂單不變(快照),未確認的 hold 以新價計。」 |
| C8 | 補:「優惠碼在 confirm 的 body 輸入;同一碼可多人用,**每人每活動一次**;不適用、過期、已用過 → 4xx,不靜默忽略。」 |
| C9 的解讀(要確認) | `specs/.../spec.md` Assumptions 有一條:為了讓「早鳥 % 套在小計上」有單一百分比可套,採「一個 hold 一個票種、N 個座位」。若作者本意是一個 hold 可混票種,請在這裡明寫混票種時早鳥 % 怎麼算(各票種分別套再加總?),並同步改 `specs/.../spec.md` 的 FR-023、FR-053 |

## 五、動到「hold 的座位粒度」的

| 決定 | 怎麼改 |
|---|---|
| C3 | 第一段補:「hold 帶票種;票種名額不足時整批失敗,與座位衝突同樣是 4xx」 |

## 六、動到「規格層的決定」第 3、4 列的 ★

| 決定 | 怎麼改 |
|---|---|
| C8 | 第 4 列(`promo_codes`)「怎麼做」欄補:「另需記錄每人每活動的使用紀錄(用在訂單上存 promo_code 即可,不必另開表)」—— 這是為了「每人每活動一次」有東西可查 |
| C17 | 第 3 列(`refresh_tokens`)「為什麼」欄補:「重放 → 撤銷該成員全部 refresh(以 `member_id` 批次 `revoked_at`)」 |

## 七、動到「硬性約束」或「一句話」的

| 決定 | 怎麼改 |
|---|---|
| C18 | 「必須被測試證明的規則」表後面加一行:「JWT 七項邊界:納入驗收,清單在 repo 外(實驗設計),由該清單裁定,此處不展開」 |
| C19 | 「一句話」的「保留十分鐘」→「保留 5–30 分鐘(預設十分鐘)」,或維持原句並在 hold 那節註明可設定 |

## 八、web 與 iOS(原文只有一句,建議新開一節「前端」放在 API 之後)

| 決定 | 建議寫法 |
|---|---|
| C1 | **web(Cloudflare Pages + daisyUI)**:登入/註冊、活動列表、活動頁(10×10 選位)、保留倒數與確認、我的票券(含 QR)。五個畫面,沒有第六個。 |
| C2 | **iOS 骨架**:登入 + 我的票券列表與明細;client 從 OpenAPI 產生;不做選位;只做離線讀取快取。 |
| C21 | **票券 QR**:訂單 id + HMAC 簽章的短字串;不含任何個資;查驗端用同一把 key 驗(但本專案不做查驗端,非目標 13)。 |

## 九、`docs/non-goals.md` 要不要動

不用。21 個決定沒有一條跨過 15 條非目標;C14 選 SQL 標記 `checked_in` 正是為了守住第 11、13 條。

## 十、`docs/verified.md`

不用回寫決定本身;但 C18 那條「JWT 七項邊界:尚未實作」維持 ❌ 欄,等外部清單跑過才能移到 ✅。

## 回寫完成後的檢查

- [ ] `docs/spec.md` 的「規格層的決定」表從 7 列變 14 列
- [ ] 活動狀態機沒有 `cancelled`
- [ ] `grep -c 'owner_id\|hold_ttl_minutes\|group_min_qty\|group_pct\|early_bird_pct' docs/spec.md` ≥ 5
- [ ] `/check-schema` 第 6 條(價格快照另一半)的人工把關描述仍成立 —— 新欄位沒有動到金額欄
- [ ] commit message 寫明「作者決定,AI 尚未介入 schema」

## 十一、plan 階段補的一條(2026-09-14,`/speckit-plan` 對 C13 的推論)

| 出處 | 內容 | 回寫到哪 |
|---|---|---|
| `data-model.md` 狀態轉換表 | C13 說「提前截止後既有 hold 仍可在到期前確認」⇒ **confirm 不再查活動 `status` / `deadline_at`,只查 hold 自己的 `expires_at`**。否則 close 之後 confirm 一定被 `not_on_sale` 擋,C13 就是空話。 | 「規格層的決定」第 12 列(C13 那列)的「怎麼做」欄補這一句;「必須被測試證明的規則」表加一行:「closed 後,截止前建立的 hold 在 `expires_at` 前 confirm → 201」 |
