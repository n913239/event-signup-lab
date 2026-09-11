# 報名:選位 → 保留 10 分鐘 → 逾時釋放 → 確認出票

## Context

repo 現況:「尺造好了,被量的東西還沒有」。有靜態檢查、閘門 helper、CI,
**沒有** `src/`、`schema.sql`、`docs/spec.md`、`docs/non-goals.md`。
這次要造第一個被量的東西:報名的核心流程(README 規則 4、5、6)。

## ⚠️ 先問(CLAUDE.md:「你認為缺的東西,先問」)

這個 session 是非互動的,問不到人,所以下面每一題都寫了**我的預設**;
不同意的直接改,我照改後的做。

| # | 問題 | 預設 |
|---|---|---|
| 1 | `docs/EXPERIMENT-PROTOCOL.md` 說 schema / 時間判定 / 併發**作者先寫、先 commit「AI 尚未介入」**。這三樣全在這次範圍內,而目前不是 git repo、也沒有作者版。**要我直接出 AI 版,還是你先 commit?** | 直接出 AI 版;完成後由你比對、寫 devlog(原文由你貼,我不代寫) |
| 2 | CLAUDE.md 說不要主動加表 / endpoint,但 `docs/non-goals.md` 不存在。我加的東西是否越界只能靠你裁決 | 三張表、三個 endpoint(見下),**不多** |
| 3 | 「成員」怎麼認?JWT 是 Day 26/28 的實驗標的,還沒寫 | 先做可抽換的 `requireMember` middleware:`Authorization: Bearer <member_id>`,標明 dev-only;JWT 之後換進來,routes 不用動 |
| 4 | 「逾時自動釋放」:**懶釋放**(SQL 把過期 hold 當空位)就已經保證正確;Cron 掃描只是把狀態掃乾淨 | 懶釋放為主 + `scheduled()` 掃描(wrangler.toml 加 `[triggers] crons = ["* * * * *"]`);不要 cron 就拿掉第二項 |
| 5 | 剩餘名額:`race.sh` 讀 `"remaining"`,`check-schema` 第 5 條要 `CHECK (remaining >= 0)` 欄位。但選位制下座位就是名額,再放一個計數器是**雙重帳**(懶釋放時會過期不同步) | `remaining` **算出來**不存欄位;`check-schema` #5 會 ❌,由你決定要不要改那條檢查 |
| 6 | 價格:這次流程不涉及金額,但硬規則 5 要價格快照 | `events.price_cents` 一欄,出票時快照到 `tickets.price_cents`;不做任何金額運算、不做折扣 |
| 7 | 開賣時間窗(`canJoin(event, now)`)是 Day 26 的題目 | **這次不做**;event 沒有 sale window |

## 設計

### 狀態機(座位)

```
free ──hold──▶ held ──confirm──▶ confirmed(出票)
  ▲              │
  └── expires_at <= now ──┘   (懶釋放 / cron 掃描)
```

- TTL = 600 秒,`expires_at = now + 600`,時間用 **INTEGER epoch 秒(UTC)**
- 邊界:`expires_at <= now` 即過期(剛好等於 = 過期),測試要打這個點
- 併發判斷全部在 SQL `WHERE`,看 `meta.changes`;`UNIQUE` / `CHECK` 是第二道

### `schema.sql`(三張表,全部 `STRICT`)

```sql
events  (id TEXT PK, name TEXT, price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
         created_at INTEGER)
seats   (event_id, seat_no, status TEXT CHECK (status IN ('free','held','confirmed')),
         hold_id TEXT, held_by TEXT, expires_at INTEGER,
         UNIQUE (event_id, seat_no),
         CHECK ((status = 'free') = (hold_id IS NULL)))   -- held/confirmed 一定有 hold_id
tickets (id TEXT PK, event_id, seat_no, member_id, hold_id,
         price_cents INTEGER NOT NULL,          -- 快照,不 JOIN
         issued_at INTEGER,
         UNIQUE (event_id, seat_no),            -- 一位一票,第二道
         UNIQUE (hold_id))
```

`seed.sql`:一個活動 + 座位 A1–A50(配合 `race.sh` 的 `A$i`)。

### 三條 SQL(併發的核心,全放在 routes 讓靜態檢查掃得到)

```sql
-- hold:空位或過期 hold 都可搶;changes=0 → 409
UPDATE seats SET status='held', hold_id=?, held_by=?, expires_at=?
 WHERE event_id=? AND seat_no=?
   AND (status='free' OR (status='held' AND expires_at <= ?));

-- confirm:batch() 一次交易,兩句同一個述詞;INSERT 0 列 = UPDATE 0 列
INSERT INTO tickets (id, event_id, seat_no, member_id, hold_id, price_cents, issued_at)
  SELECT ?, s.event_id, s.seat_no, s.held_by, s.hold_id, e.price_cents, ?
    FROM seats s JOIN events e ON e.id = s.event_id
   WHERE s.hold_id=? AND s.held_by=? AND s.status='held' AND s.expires_at > ?;
UPDATE seats SET status='confirmed'
 WHERE hold_id=? AND held_by=? AND status='held' AND expires_at > ?;
-- changes=0 之後再查一次 seats 決定 404 / 409(已確認) / 410(過期)

-- release(cron 或懶):
UPDATE seats SET status='free', hold_id=NULL, held_by=NULL, expires_at=NULL
 WHERE status='held' AND expires_at <= ?;
```

### 檔案

```
schema.sql / seed.sql
src/worker.js              export { fetch: app.fetch, scheduled }  ← 唯一取 Date.now() 的地方之一
src/app.js                 createApp({ now })  — now 是函式,測試可換假時鐘
src/routes/auth.js         requireMember(dev-only Bearer <member_id>)
src/routes/events.js       GET  /events/:id
src/routes/holds.js        POST /events/:id/holds、POST /holds/:id/confirm
src/domain/hold.js         HOLD_TTL_SECONDS、expiresAt(now)、isExpired(seat, now)、
                           classifyConfirmFailure(seat, now) → 'not_found'|'already_confirmed'|'expired'
src/domain/seat.js         狀態列舉、visibleStatus(seat, now)(過期 hold 對外顯示 free)
src/presentation/index.js  toEventView / toHoldView / toTicketView(純 JSON 整形,不除法)
tests/helpers/db.js        wrangler getPlatformProxy → env.DB,套 schema.sql;每個測試重建
tests/domain/hold.test.js  純函式:TTL、邊界
tests/holds.test.js        HTTP 流程 + 狀態碼
tests/concurrency.test.js  閘門競態(CI 重跑 5 次的那支)
```

- `src/domain/` 零 I/O、零 `Date.now()`;`now` 與 `hold_id`(`crypto.randomUUID()`)都由 routes 傳入
- 不新增套件:測試用 `wrangler` 的 `getPlatformProxy()` 拿真的本地 D1,用 Hono `app.request()` 直打,不用啟 server

### Endpoint

| | 成功 | 失敗 |
|---|---|---|
| `GET /events/:id` | 200 `{id, name, remaining, seats:[{seat_no, status}]}`,remaining 與 status 都以 `now` 計算 | 404 |
| `POST /events/:id/holds` `{seat_no}` | 201 `{hold_id, seat_no, expires_at}` | 400 缺 seat_no、401、404 座位不存在、409 已被佔 |
| `POST /holds/:id/confirm` | 201 `{ticket_id, seat_no, price_cents, issued_at}` | 401、404 不存在或不是你的、409 已確認、410 已過期 |

## 測試(先紅再綠)

1. `tests/domain/hold.test.js` — `expiresAt(now) = now+600`;`isExpired` 在 `now = expires_at` 為 true、`now = expires_at-1` 為 false
2. `tests/holds.test.js` — 完整流程;過期後 confirm 410;過期後別人可搶同一位;搶到後原持有人 confirm 404(hold_id 已換人);已確認再 confirm 409
3. `tests/concurrency.test.js`,每個情境 `repeat(5)`:
   - 50 人閘門同搶 **同一位** → 恰 1 個 201、49 個 409,`tickets` 0 筆、seats 恰 1 列 held
   - 50 人搶 50 個不同位 → 50 個 201,remaining = 0
   - **三方競態**(README 規則 6):`now = expires_at` 時,持有人 confirm、他人 hold、cron release 同時放行 → 持有人一定 410;最終狀態恰為「他人 held」或「free」;tickets 0 筆
   - 持有人 confirm 與他人 hold 在 `now = expires_at - 1` 同時 → 持有人 201、他人 409

## 驗證

```bash
npm ci
sh scripts/self-test.sh && npm run check:all     # 靜態三支要綠
npm test
for i in 1 2 3 4 5; do npm run test:race || break; done
npm run db:init && npm run db:seed && npm run dev  # 另一個 shell:
EVENT_ID=<seed 的 id> TOKEN=m1 sh scripts/race.sh 50   # remaining 不得為負
```

完成後更新 `docs/verified.md`:把實際跑過、有輸出的搬到 ✅,寫明日期與指令。
`smoke.sh` 這次**不填**(它要的是「建活動 → 開賣」,建活動不在範圍內,先問)。

## 不做(這次)

- JWT、開賣時間窗、折扣、取消 hold(`DELETE /holds/:id`)、建活動 API、前端、OpenAPI
- devlog 由你寫(原文貼,我不轉述)
- git commit:目前不是 repo;若要照協定留證據,先 `git init` 並 commit 作者版
