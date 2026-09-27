# Research: 活動報名系統(完整功能)

**Phase 0 output** · 2026-09-27

Technical Context 沒有 NEEDS CLARIFICATION:技術棧由使用者鎖死,實作已在 repo。
本文件不是選型研究,而是把**現況已經做了的設計決定**逐條寫成 Decision / Rationale / Alternatives,
出處是程式碼註解、`docs/spec.md` 的作者決定與 commit 紀錄。沒有新增任何決定。

---

## R-01 全有全無的保留:裸 `INSERT` + `db.batch()`

- **Decision**:`createHold` 在一個 `db.batch()` 裡依序:還過期名額 → 翻過期 → 逐座裸 `INSERT INTO seat_holds` → 扣名額。任何一句拋錯整批回滾。
- **Rationale**:D1 的 batch 只在**拋錯**時回滾;`changes = 0` 不算失敗。`docs/spec.md`「hold 的座位粒度」實跑驗證過:
  `ON CONFLICT DO NOTHING` 會讓第一個座位留下來。
- **Alternatives**:`ON CONFLICT DO NOTHING` + 看 `changes`(被原文否決,會鎖住部分座位);應用層先查空位(違反規則 III)。

## R-02 座位唯一:部分唯一索引,述詞含 `confirmed`

- **Decision**:`ux_seat_active ON seat_holds(event_id, seat_no) WHERE status IN ('holding','confirmed')`;過期、取消的列留著不刪。
- **Rationale**:述詞只寫 `holding` 的話,確認那一刻座位反而失去保護(原文 2026-09-10 實跑驗證)。留列是為了留證據(三方競態誰怎麼輸)。
- **Alternatives**:獨立座位表 + 狀態欄(多一張表,違反「不要主動加表」);刪除過期列(失去證據)。

## R-03 沒有 `holds` 表:hold 由 `seat_holds` 的 `hold_id` 聚合

- **Decision**:一個 hold = 同一 `hold_id` 的多列 `seat_holds`;`seq = 0` 那列是代表列,給 `ux_member_holding`(一人一活動一個 holding)用。
- **Rationale**:hold 的狀態就是它的座位列狀態;多一張表會產生兩處狀態要同步。
- **Alternatives**:`holds` 表 + `seat_holds` 子表(兩處狀態、併發時要一起翻)。

## R-04 逾時釋放:搶位時當場翻 + Cron 清理

- **Decision**:索引看 `status` 不看時間,所以搶位的 batch 第一步就是把該活動 `holding AND expires_at <= now` 翻成 `expired` 並還名額;
  另由 `wrangler.toml` 的 Cron `*/5 * * * *` 跑 `sweepExpired` 清沒人搶的。座位圖與剩餘名額的讀取另以 `expires_at > now` 判斷有效。
- **Rationale**:「釋放」與「搶到」在同一個 batch,不需要背景排程也成立;Cron 是三方競態的第三方。
- **Alternatives**:只靠排程(排程間隔內座位搶不到);Durable Objects 計時(非目標「不做的架構」)。

## R-05 到期那一刻原持有人輸

- **Decision**:`isHoldExpired` 用 `now >= expires_at`;確認的 SQL 用 `expires_at > ?`。兩處一致。
- **Rationale**:作者 2026-09-27 定(R「三方競態」);時間可注入,所以相等那一刻可以被測試釘住。
- **Alternatives**:相等時持有人贏(與搶位的 `expires_at <= ?` 會重疊,兩邊都成功)。

## R-06 扣名額用 `CHECK (remaining >= 0)` 拋錯

- **Decision**:扣名額是 `remaining = remaining - ?`,超賣由 CHECK 拋錯整批回滾 → `sold_out`;座位 INSERT 在前,所以同時衝突回 `seat_taken`。
- **Rationale**:原文 R6 與「錯誤優先」(作者定)。
- **Alternatives**:`WHERE remaining >= ?` + 看 `changes`(batch 不會因此回滾,前面的座位列會留下)。⚠️ 與規則 III 字面的張力見 plan G3-a。

## R-07 名額總和 ≤ 100:條件式 INSERT + trigger

- **Decision**:新增票種用 `INSERT … SELECT … WHERE SUM + ? <= 100`;改名額時路由先驗,schema 的 `trg_ticket_types_sum_insert/update` 以 `RAISE(ABORT)` 當第二道。
- **Rationale**:跨列條件寫不進 CHECK;只有拋錯才會讓 batch 回滾(T082 的紅燈:「改名額」與「加票種」同時到,總和到 110)。
- **Alternatives**:只靠路由先驗(T082 證明擋不住)。

## R-08 確認:翻狀態與建單同一個 batch

- **Decision**:`UPDATE seat_holds … WHERE status='holding' AND expires_at > ?` → `INSERT orders … WHERE changes() = n` → `INSERT order_items … SELECT`;
  回傳看 `changes === n`。輸了再讀一次:若已被別的 confirm 確認 → 回同一張訂單(H7)。
- **Rationale**:勝負判斷在 SQL;H7 併發(兩個 confirm 同時到)只會有一張訂單。
- **Alternatives**:先查 hold 狀態再寫(違反規則 III)。

## R-09 擇優折扣:純函式、整數、嚴格小於

- **Decision**:`quote()` 依 優惠碼 → 早鳥 → 團體 排列候選,`reduce` 以嚴格 `<` 換人(平手留給前面)。
  無效碼的 409 判斷(`blocks`)在 `routes/holds.js` 的 `price()`。
- **Rationale**:原文「折扣怎麼算」2026-09-27 改定;作者 Q9 定「同額忽略」。
- **Alternatives**:疊加(原 2026-09-10 規格,已被作者改掉)。

## R-10 JWT 自製 HS256;refresh 存雜湊、輪替、重放撤銷全部

- **Decision**:access 15 分鐘無狀態;refresh 為 32 bytes 亂數,DB 存 SHA-256;輪替 = 條件式 `UPDATE … WHERE revoked_at IS NULL AND expires_at > ?` 成功才發新的(不放同一 batch);
  用到已撤銷的 → 撤銷該成員全部、回 `refresh_replayed`。
- **Rationale**:原文決定 3;非目標 12(自製 JWT 是題目本身);JWT 邊界由 `tests/jwt.test.js` 六個測試裁定。
- **Alternatives**:第三方登入(非目標 12)。

## R-11 登入鎖定存在 `members`

- **Decision**:`members.failed_logins`、`locked_until`;失敗時條件式 UPDATE(`WHERE locked_until IS NULL OR locked_until <= ?`,鎖定中不累計),
  鎖定時間 `5 × 2^min(4, n−5)` 分鐘、上限 60。
- **Rationale**:作者 2026-09-27 定(L1、clarify Q43)。
- **Alternatives**:獨立的嘗試紀錄表(違反「不要主動加表」)。

## R-12 時間注入點在 `createApp`

- **Decision**:`createApp({ now = Date.now })`,中介層每請求取一次存進 context,回應帶 `x-server-now`;`scheduled` 自己取 `Date.now()`。
- **Rationale**:規則 II;前端倒數以伺服器時間為準。
- **Alternatives**:在每個 route 取時間(多個取點,測試要到處注入)。⚠️ 取點在 `app.js` 不在 `routes/`,見 plan G2-a。

## R-13 契約一份,三端各自消費

- **Decision**:根目錄 `openapi.yaml`(3.1.0)是唯一契約。API 以 `tests/contract.test.js`(ajv 2020)驗回應;
  iOS 以 swift-openapi-generator build plugin 產 client(需要檔案在 target 內,由 `scripts/sync-openapi.sh` 複製);web 手寫 `api.js`。
- **Rationale**:使用者鎖定的技術棧;generator plugin 的限制。
- **Alternatives**:iOS 用 symlink 取代副本(未評估);web 用產生器(未採用)。⚠️ 見 plan C-2。

## R-14 金額顯示三處

- **Decision**:API `src/presentation/money.js`(`centsToDisplay`,無 NT$)、web `web/src/lib/money.js`(`formatCents`,取餘數、固定逗號)、
  iOS `Tickets/Money.swift`(`quotientAndRemainder` + `NumberFormatter`)。
- **Rationale**:規則 I 的三個允許位置(2026-09-27)。
- **Alternatives**:API 回格式化字串(API 只回整數分與代碼,non-goals 已定)。⚠️ iOS locale,見 plan G1-a。

## R-15 測試用真的 D1

- **Decision**:`getPlatformProxy({ persist: false })` 拿 miniflare D1;`fileParallelism: false`;併發用閘門。
- **Rationale**:規則有一半靠 SQL 語意(條件式寫入的 `changes`、部分唯一索引、batch 原子性),shim 是一把沒驗過的尺。
- **Alternatives**:better-sqlite3 等 shim(被否決)。

## 未解(不屬本 plan 能決定)

- 【待作者確認】Q11、Q24、Q26(見 spec Assumptions)。
- SC-009 `rows_read` 量測方法:D1 回應的 `meta.rows_read` 可取得,但 repo 沒有量測腳本或紀錄,要量哪個環境(local miniflare 或遠端 D1)也未定 → 交給 tasks。
