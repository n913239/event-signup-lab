計畫寫在 `/Users/<host>/.claude/plans/polished-zooming-sunbeam.md`。這個 session 是非互動的(`AskUserQuestion` / `ExitPlanMode` 都不可用),所以我沒法問,只能把問題連同預設寫進計畫。動手前你需要裁決的事:

**必須先回答的(CLAUDE.md 說「缺的東西先問」)**

1. **實驗協定衝突**:`docs/EXPERIMENT-PROTOCOL.md` 規定 schema / 時間判定 / 併發要**作者先 commit「AI 尚未介入」**。這次範圍三樣全中,而目錄目前不是 git repo、沒有作者版。要我直接出 AI 版,還是你先 commit?
2. `docs/non-goals.md`、`docs/spec.md` 都不存在,CLAUDE.md 和 `check-schema` 卻引用它們。我打算加 **3 張表(events / seats / tickets)、3 個 endpoint**,越不越界只有你能判。
3. **成員認證**:JWT 是 Day 26/28 的題目。預設做可抽換的 `requireMember` middleware(dev-only `Bearer <member_id>`),之後換 JWT 不動 routes。
4. **剩餘名額**:`check-schema` #5 要 `CHECK (remaining >= 0)` 欄位,但選位制下座位就是名額,再放計數器是雙重帳(懶釋放時會不同步)。預設 `remaining` 算出來不存欄,那條檢查會 ❌。

**設計要點**(細節在計畫檔)

- 座位狀態機 `free → held → confirmed`,TTL 600 秒,`expires_at <= now` 即過期
- 三條 SQL 全在 `WHERE` 裡裁決、看 `changes`;confirm 用 `batch()` 兩句同述詞(INSERT…SELECT + UPDATE),`UNIQUE(event_id, seat_no)` 當第二道
- 逾時釋放 = **懶釋放**(過期 hold 在 SQL 裡視為空位)+ cron `scheduled()` 掃乾淨
- 測試不加套件:用 `wrangler` 的 `getPlatformProxy()` 拿真的本地 D1,Hono `app.request()` 直打;併發用閘門,含「持有人 confirm × 他人搶位 × cron 釋放」的三方競態,`repeat(5)`

回覆哪幾題要改,我照改後的做。