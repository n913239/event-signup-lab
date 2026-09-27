在 Cloudflare Workers + D1 上,寫活動報名系統的座位保留:`src/lib/db/holds.js`(ES module)。

行為要求:
- FR-030:成員能對 `on_sale` 且在 `opens_at` ≤ now < `deadline_at` 的活動建立 hold(這個檢查呼叫端已經做了,你不用管)
- FR-031:hold 到期時間 = 建立時間 + 活動的 `hold_ttl_minutes`
- FR-032:同一成員在同一活動只能有一個有效 hold;已有時再建 → 失敗
- FR-033:hold 過期後,座位要能被別人搶到;釋放與搶到要在同一次搶位操作內成立,不依賴背景排程
- FR-034:另有定期清掃,把沒有人來搶的過期 hold 標為 `expired`
- FR-035:過期 hold 紀錄留著不刪
- 一次 hold 可以包含多個座位(同一票種),全部成功或全部失敗
- 票種有名額(`ticket_types.remaining`),建 hold 時扣;放棄、過期時還回去;名額不夠 → 失敗

要匯出(呼叫端會照這個介面用):
- `createHold(db, { eventId, memberId, ticketTypeId, seatNos, ttlMinutes }, now)` → 成功回 `{ hold: { id, event_id, ticket_type_id, seat_nos, status: 'holding', expires_at } }`,失敗回 `{ error }`,`error` 是 `'seat_taken'`、`'hold_exists'`、`'sold_out'` 其中之一
- `releaseHold(db, { holdId, memberId }, now)` → 回放棄了幾個座位(0 = 不是本人的或已經不是 holding)
- `sweepExpired(db, now)` → 回清掉了幾個座位
- `findHold(db, holdId, memberId)` → 回 `{ id, event_id, ticket_type_id, status, expires_at, created_at, seat_nos }` 或 null

`now` 是 epoch 毫秒。`db` 是 D1 binding。資料表已經建好:
```sql
CREATE TABLE ticket_types (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL,
  name TEXT NOT NULL
    CHECK (length(name) BETWEEN 1 AND 100),
  price_cents INTEGER NOT NULL
    CHECK (price_cents >= 0),
  capacity INTEGER NOT NULL
    CHECK (capacity >= 0),
  remaining INTEGER NOT NULL
    CHECK (remaining >= 0),
  early_bird_until INTEGER,
  early_bird_pct INTEGER NOT NULL DEFAULT 0
    CHECK (early_bird_pct BETWEEN 0 AND 100),
  CHECK (remaining <= capacity),
  UNIQUE (event_id, name),
  FOREIGN KEY (event_id) REFERENCES events(id)
) STRICT;
CREATE TABLE seat_holds (
  id TEXT PRIMARY KEY NOT NULL,
  hold_id TEXT NOT NULL,
  seq INTEGER NOT NULL
    CHECK (seq >= 0),
  event_id TEXT NOT NULL,
  seat_no TEXT NOT NULL,
  ticket_type_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('holding', 'confirmed', 'expired', 'cancelled')),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,

  CHECK (
    (
      length(seat_no) = 2
      AND substr(seat_no, 1, 1) GLOB '[A-J]'
      AND substr(seat_no, 2, 1) GLOB '[1-9]'
    )
    OR
    (
      length(seat_no) = 3
      AND substr(seat_no, 1, 1) GLOB '[A-J]'
      AND substr(seat_no, 2, 2) = '10'
    )
  ),

  FOREIGN KEY (event_id) REFERENCES events(id),
  FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id),
  FOREIGN KEY (member_id) REFERENCES members(id)
) STRICT;
CREATE UNIQUE INDEX ux_seat_active
  ON seat_holds(event_id, seat_no)
  WHERE status IN ('holding', 'confirmed');

CREATE UNIQUE INDEX ux_member_holding
  ON seat_holds(member_id, event_id)
  WHERE status = 'holding' AND seq = 0;

```

只寫這一個檔,不要寫測試。
