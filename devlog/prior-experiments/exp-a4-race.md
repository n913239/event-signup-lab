# 揪團訂飲料 — 截止瞬間的併發正確性(Cloudflare Workers + Hono + D1)

## 0. 先講結論

在 D1 上,「先查再寫」永遠是錯的,而且**沒有辦法用交易補救**——D1 不支援互動式交易(interactive transaction),`batch()` 雖然是一個交易,但它是預先組好的語句陣列,你沒辦法在中間讀結果再決定要不要寫。

所以正確做法只有一個方向:**把「檢查」塞進「寫入」的同一個 SQL 語句裡**,靠 SQLite 的單語句原子性 + D1 單一 primary 的寫入序列化來保證正確,再看 `meta.changes` 判斷有沒有真的寫進去。

三根支柱:

1. **守衛式寫入(guarded write)**:截止時間、容量上限都寫在 `INSERT ... SELECT ... WHERE` 裡,一句話完成檢查與寫入。
2. **冪等鍵(idempotency key)**:`UNIQUE(event_id, request_id)` + `ON CONFLICT DO NOTHING`。截止前一秒使用者狂點按鈕、瀏覽器 timeout 重送、你自己的 retry,全部只會產生一筆。
3. **時間以 DB 為準**:截止判斷用 SQLite 自己的時鐘,不用 Worker 的 `Date.now()`,避免多個 PoP 各自報時。

---

## 1. 截止瞬間真正會發生的五種錯

| # | 情境 | 錯誤結果 |
|---|---|---|
| 1 | 兩人同時送單,程式先 `SELECT closes_at` 判斷未截止,再 `INSERT` | 兩筆都寫進去,但其中一筆其實已經超過截止 |
| 2 | 有數量上限(例如「這家只收 30 杯」),先 `SELECT count(*)` 再 `INSERT` | 經典 lost update,收到 34 杯 |
| 3 | 使用者連點三下送出 / 網路慢重送 | 同一個人三筆重複訂單 |
| 4 | Worker 收到 D1 transient error 後自己 retry | 第一次其實成功了,retry 造成重複 |
| 5 | 送單成功後馬上導回列表頁,讀到 read replica | 使用者看不到自己剛下的單,以為失敗,再送一次 → 回到 #3 |

第 5 個最陰險,它不是「資料錯」而是「使用者被誤導去製造資料錯」。解法是 D1 Sessions API。

---

## 2. schema.sql

```sql
-- schema.sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS events (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  shop        TEXT NOT NULL,
  -- 截止時間,epoch milliseconds。判斷一律用這個欄位,不要用 status 當截止依據。
  closes_at   INTEGER NOT NULL,
  -- NULL = 不限杯數;否則是總杯數上限
  capacity    INTEGER,
  -- 只用來「提前手動關閉」,不是自動截止用的
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  -- 反正規化的杯數計數器,由 trigger 維護,讓容量檢查可以塞進單一語句
  cups_taken  INTEGER NOT NULL DEFAULT 0 CHECK (cups_taken >= 0),
  created_by  TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id           TEXT PRIMARY KEY,
  event_id     TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL,
  display_name TEXT NOT NULL,
  item         TEXT NOT NULL,
  qty          INTEGER NOT NULL CHECK (qty >= 1 AND qty <= 10),
  note         TEXT,
  -- 冪等鍵:由 client 產生的 UUID,同一次送出行為重試時必須帶同一個值
  request_id   TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  UNIQUE (event_id, request_id)
);

CREATE INDEX IF NOT EXISTS idx_orders_event  ON orders (event_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_user   ON orders (event_id, user_id);

-- 計數器由 trigger 維護 → INSERT 與計數更新在同一個語句的交易範圍內,不可能脫節
CREATE TRIGGER IF NOT EXISTS orders_after_insert
AFTER INSERT ON orders
BEGIN
  UPDATE events SET cups_taken = cups_taken + NEW.qty WHERE id = NEW.event_id;
END;

CREATE TRIGGER IF NOT EXISTS orders_after_delete
AFTER DELETE ON orders
BEGIN
  UPDATE events SET cups_taken = cups_taken - OLD.qty WHERE id = OLD.event_id;
END;

CREATE TRIGGER IF NOT EXISTS orders_after_update_qty
AFTER UPDATE OF qty ON orders
BEGIN
  UPDATE events SET cups_taken = cups_taken - OLD.qty + NEW.qty WHERE id = NEW.event_id;
END;
```

**如果你不喜歡 trigger**:可以拿掉 `cups_taken` 與三個 trigger,把容量守衛改成子查詢(見 §3 註解裡的變體)。單語句一樣原子,只是每次 INSERT 要掃一次該團的訂單。揪團規模(n < 200)完全無所謂,大表才需要計數器。

**可選的額外規則**:如果你要「一人一團只能一筆」,加上

```sql
CREATE UNIQUE INDEX idx_orders_one_per_user ON orders (event_id, user_id);
```

這樣連 #3 的重複都由 DB 擋掉,而不只是靠冪等鍵。

---

## 3. src/orders.ts — 核心的守衛式寫入

```ts
// src/orders.ts

/** D1Database 與 D1DatabaseSession 都符合這個形狀,讓 repo 層不必知道用哪個 */
type Queryable = { prepare(query: string): D1PreparedStatement };

/**
 * 以 D1 primary 自己的時鐘取得 epoch milliseconds。
 *
 * 為什麼不用 Worker 的 Date.now():
 *  1. 每個請求可能落在不同 PoP,各自的時鐘不保證一致到毫秒。
 *  2. Workers 的 Date.now() 只在 I/O 之後推進,同一個請求裡讀到的是「凍結」的時間。
 * 截止判斷需要一個單一權威時鐘,而所有寫入都會經過同一台 D1 primary。
 *
 * julianday() 的寫法在所有 SQLite 版本都可用;若你的 D1 已是 3.42+,
 * 可以換成更好讀的 CAST(unixepoch('subsec') * 1000 AS INTEGER)。
 */
const NOW_MS = `CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)`;

export type OrderRow = {
  id: string;
  event_id: string;
  user_id: string;
  display_name: string;
  item: string;
  qty: number;
  note: string | null;
  request_id: string;
  created_at: number;
};

export type PlaceInput = {
  eventId: string;
  userId: string;
  displayName: string;
  item: string;
  qty: number;
  note?: string | null;
  requestId: string; // 冪等鍵
};

export type PlaceResult =
  | { ok: true; replay: boolean; order: OrderRow }
  | {
      ok: false;
      reason: 'no_such_event' | 'closed_early' | 'deadline_passed' | 'sold_out';
      detail: { nowMs: number; closesAt?: number; capacity?: number | null; cupsTaken?: number };
    };

/**
 * 送出訂單。
 *
 * 整個「檢查截止 → 檢查容量 → 檢查重複 → 寫入 → 更新計數」是 **一個 SQL 語句**:
 *   - WHERE 子句裡的三個條件與 INSERT 在同一個語句 → 原子,不可能被別的請求插隊。
 *   - ON CONFLICT DO NOTHING 處理重送。
 *   - AFTER INSERT trigger 更新 cups_taken,與 INSERT 同一交易。
 * 沒有任何 read-then-write 的縫隙。
 */
export async function placeOrder(db: Queryable, input: PlaceInput): Promise<PlaceResult> {
  const id = crypto.randomUUID();

  const res = await db
    .prepare(
      `
      INSERT INTO orders
        (id, event_id, user_id, display_name, item, qty, note, request_id, created_at)
      SELECT ?1, e.id, ?3, ?4, ?5, ?6, ?7, ?8, ${NOW_MS}
        FROM events e
       WHERE e.id = ?2
         AND e.status = 'open'
         AND ${NOW_MS} < e.closes_at
         AND (e.capacity IS NULL OR e.cups_taken + ?6 <= e.capacity)
      ON CONFLICT (event_id, request_id) DO NOTHING
      `
      //  不用 trigger 的變體:把最後一個條件換成
      //   AND (e.capacity IS NULL OR
      //        (SELECT COALESCE(SUM(o.qty), 0) FROM orders o WHERE o.event_id = e.id) + ?6 <= e.capacity)
      //
      //  注意:INSERT ... SELECT 後面接 ON CONFLICT 時,SQLite 需要 SELECT 帶 WHERE
      //  才不會把 ON 誤判成 JOIN 的一部分。這裡本來就有 WHERE,所以沒問題。
    )
    .bind(
      id,
      input.eventId,
      input.userId,
      input.displayName,
      input.item,
      input.qty,
      input.note ?? null,
      input.requestId,
    )
    .run();

  // meta.changes 只算外層語句寫入的列數,不含 trigger 內部的 UPDATE。
  // (meta.rows_written 會含 trigger,別拿它來判斷成功與否。)
  if (res.meta.changes === 1) {
    const order = await getOrderByRequestId(db, input.eventId, input.requestId);
    return { ok: true, replay: false, order: order! };
  }

  // changes === 0 有兩種可能:撞到冪等鍵(重送),或守衛條件不成立。
  // 先查冪等鍵,查得到就是重送 → 回傳原本那筆,對 client 而言等同成功。
  const existing = await getOrderByRequestId(db, input.eventId, input.requestId);
  if (existing) return { ok: true, replay: true, order: existing };

  // 到這裡才是真的失敗。這個查詢只為了產生人看得懂的錯誤訊息,
  // 就算此刻狀態又變了也無所謂——寫入已經確定沒發生,不影響正確性。
  const e = await db
    .prepare(
      `SELECT status, closes_at, capacity, cups_taken, ${NOW_MS} AS now_ms
         FROM events WHERE id = ?1`,
    )
    .bind(input.eventId)
    .first<{
      status: string;
      closes_at: number;
      capacity: number | null;
      cups_taken: number;
      now_ms: number;
    }>();

  if (!e) {
    return { ok: false, reason: 'no_such_event', detail: { nowMs: Date.now() } };
  }
  const detail = {
    nowMs: e.now_ms,
    closesAt: e.closes_at,
    capacity: e.capacity,
    cupsTaken: e.cups_taken,
  };
  if (e.now_ms >= e.closes_at) return { ok: false, reason: 'deadline_passed', detail };
  if (e.status !== 'open') return { ok: false, reason: 'closed_early', detail };
  return { ok: false, reason: 'sold_out', detail };
}

export function getOrderByRequestId(db: Queryable, eventId: string, requestId: string) {
  return db
    .prepare(`SELECT * FROM orders WHERE event_id = ?1 AND request_id = ?2`)
    .bind(eventId, requestId)
    .first<OrderRow>();
}

/**
 * 取消訂單。同樣是守衛式寫入:截止之後不准取消。
 * SQLite 的 DELETE 不支援 JOIN,所以守衛寫在 EXISTS 子查詢裡,仍是單一語句。
 */
export async function cancelOrder(
  db: Queryable,
  args: { eventId: string; orderId: string; userId: string },
): Promise<{ ok: true } | { ok: false; reason: 'not_found_or_locked' }> {
  const res = await db
    .prepare(
      `
      DELETE FROM orders
       WHERE id = ?1
         AND event_id = ?2
         AND user_id = ?3
         AND EXISTS (
               SELECT 1 FROM events e
                WHERE e.id = orders.event_id
                  AND e.status = 'open'
                  AND ${NOW_MS} < e.closes_at
             )
      `,
    )
    .bind(args.orderId, args.eventId, args.userId)
    .run();

  return res.meta.changes === 1 ? { ok: true } : { ok: false, reason: 'not_found_or_locked' };
}

/** 開團。closesAt 由 caller 給 epoch ms。 */
export async function createEvent(
  db: Queryable,
  args: {
    title: string;
    shop: string;
    closesAt: number;
    capacity: number | null;
    createdBy: string;
  },
) {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO events (id, title, shop, closes_at, capacity, created_by, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ${NOW_MS})`,
    )
    .bind(id, args.title, args.shop, args.closesAt, args.capacity, args.createdBy)
    .run();
  return id;
}

/** 提前關團。只有團主可以,而且是冪等的。 */
export async function closeEventEarly(db: Queryable, eventId: string, userId: string) {
  const res = await db
    .prepare(`UPDATE events SET status = 'closed' WHERE id = ?1 AND created_by = ?2`)
    .bind(eventId, userId)
    .run();
  return res.meta.changes === 1;
}

/** 讀團 + 訂單。順便回傳 DB 的 now,讓前端可以算時鐘偏差、顯示正確倒數。 */
export async function readEvent(db: Queryable, eventId: string) {
  const [ev, orders] = await Promise.all([
    db
      .prepare(
        `SELECT *, ${NOW_MS} AS server_now_ms,
                (${NOW_MS} < closes_at AND status = 'open') AS is_open
           FROM events WHERE id = ?1`,
      )
      .bind(eventId)
      .first(),
    db
      .prepare(`SELECT * FROM orders WHERE event_id = ?1 ORDER BY created_at ASC`)
      .bind(eventId)
      .all<OrderRow>(),
  ]);
  return ev ? { event: ev, orders: orders.results } : null;
}
```

---

## 4. src/index.ts — Hono 路由與 Sessions API

```ts
// src/index.ts
import { Hono } from 'hono';
import { createEvent, cancelOrder, closeEventEarly, placeOrder, readEvent } from './orders';

type Bindings = { DB: D1Database };
const app = new Hono<{ Bindings: Bindings }>();

const BOOKMARK_HEADER = 'x-d1-bookmark';

/** 這裡換成你真正的驗證(JWT / LINE Login / Cloudflare Access) */
function requireUser(c: any): { id: string; name: string } {
  const id = c.req.header('x-user-id');
  const name = c.req.header('x-user-name') ?? id;
  if (!id) throw Object.assign(new Error('unauthenticated'), { status: 401 });
  return { id, name };
}

const HTTP_STATUS = {
  no_such_event: 404,
  closed_early: 409,
  deadline_passed: 409, // 「你晚了 0.4 秒」是衝突,不是壞請求
  sold_out: 409,
} as const;

// ── 送單 ───────────────────────────────────────────────────────────────
app.post('/api/events/:eventId/orders', async (c) => {
  const user = requireUser(c);
  const eventId = c.req.param('eventId');

  // 冪等鍵由 client 帶。沒帶就拒絕——這是整套防重複的地基,不要幫它產生預設值,
  // 因為 server 端產生的 UUID 每次重試都不同,等於沒有冪等。
  const requestId = c.req.header('idempotency-key') ?? '';
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(requestId)) {
    return c.json({ error: 'missing_or_invalid_idempotency_key' }, 400);
  }

  const body = await c.req.json<{ item?: unknown; qty?: unknown; note?: unknown }>().catch(() => ({}));
  const item = typeof body.item === 'string' ? body.item.trim() : '';
  const qty = Number(body.qty);
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 200) : null;

  if (!item || item.length > 100) return c.json({ error: 'invalid_item' }, 400);
  if (!Number.isInteger(qty) || qty < 1 || qty > 10) return c.json({ error: 'invalid_qty' }, 400);

  // 寫入一律走 primary,並取得 bookmark 交給 client,讓它接下來的讀取看得到自己的寫入。
  const session = c.env.DB.withSession('first-primary');

  const result = await withRetry(() =>
    placeOrder(session, {
      eventId,
      userId: user.id,
      displayName: user.name,
      item,
      qty,
      note,
      requestId,
    }),
  );

  const bookmark = session.getBookmark();
  if (bookmark) c.header(BOOKMARK_HEADER, bookmark);

  if (!result.ok) {
    return c.json({ error: result.reason, detail: result.detail }, HTTP_STATUS[result.reason]);
  }
  // 重送回 200 + replay:true,新單回 201。兩者對使用者都是「成功」。
  return c.json({ order: result.order, replay: result.replay }, result.replay ? 200 : 201);
});

// ── 讀取(read-your-writes)───────────────────────────────────────────
app.get('/api/events/:eventId', async (c) => {
  // client 把上一次拿到的 bookmark 帶回來 → 保證不會讀到比自己寫入更舊的 replica。
  // 沒有 bookmark 時用 first-unconstrained,讓它讀最近的 replica,便宜又快。
  const bookmark = c.req.header(BOOKMARK_HEADER) ?? 'first-unconstrained';
  const session = c.env.DB.withSession(bookmark);

  const data = await readEvent(session, c.req.param('eventId'));

  const next = session.getBookmark();
  if (next) c.header(BOOKMARK_HEADER, next);

  if (!data) return c.json({ error: 'no_such_event' }, 404);
  return c.json(data);
});

// ── 取消 ───────────────────────────────────────────────────────────────
app.delete('/api/events/:eventId/orders/:orderId', async (c) => {
  const user = requireUser(c);
  const session = c.env.DB.withSession('first-primary');
  const r = await withRetry(() =>
    cancelOrder(session, {
      eventId: c.req.param('eventId'),
      orderId: c.req.param('orderId'),
      userId: user.id,
    }),
  );
  const bookmark = session.getBookmark();
  if (bookmark) c.header(BOOKMARK_HEADER, bookmark);
  if (!r.ok) return c.json({ error: r.reason }, 409);
  return c.body(null, 204);
});

// ── 開團 / 提前關團 ───────────────────────────────────────────────────
app.post('/api/events', async (c) => {
  const user = requireUser(c);
  const b = await c.req.json<{ title: string; shop: string; closesAt: number; capacity?: number | null }>();
  if (!Number.isInteger(b.closesAt) || b.closesAt < Date.now()) {
    return c.json({ error: 'closes_at_must_be_future_epoch_ms' }, 400);
  }
  const session = c.env.DB.withSession('first-primary');
  const id = await createEvent(session, {
    title: b.title,
    shop: b.shop,
    closesAt: b.closesAt,
    capacity: b.capacity ?? null,
    createdBy: user.id,
  });
  const bookmark = session.getBookmark();
  if (bookmark) c.header(BOOKMARK_HEADER, bookmark);
  return c.json({ id }, 201);
});

app.post('/api/events/:eventId/close', async (c) => {
  const user = requireUser(c);
  const session = c.env.DB.withSession('first-primary');
  const ok = await closeEventEarly(session, c.req.param('eventId'), user.id);
  return ok ? c.body(null, 204) : c.json({ error: 'not_owner_or_not_found' }, 403);
});

/**
 * D1 偶爾會丟 transient 錯誤(連線中斷、storage 暫時不可用)。
 * 因為所有寫入都有冪等鍵保護,retry 是安全的——這正是冪等鍵存在的第二個理由。
 * 沒有冪等鍵就不要 retry 寫入。
 */
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = String((err as Error)?.message ?? '');
      const transient =
        msg.includes('Network connection lost') ||
        msg.includes('storage caused object to be reset') ||
        msg.includes('D1_ERROR: internal') ||
        msg.includes('reset because its code was updated');
      if (!transient) throw err;
      await new Promise((r) => setTimeout(r, 25 * 2 ** i + Math.random() * 25));
    }
  }
  throw lastErr;
}

app.onError((err, c) => {
  const status = (err as any).status ?? 500;
  if (status === 500) console.error(err);
  return c.json({ error: status === 500 ? 'internal_error' : err.message }, status);
});

export default app;
```

---

## 5. 設定檔

```jsonc
// wrangler.jsonc
{
  "name": "drink-run",
  "main": "src/index.ts",
  "compatibility_date": "2026-08-01",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "drink-run",
      "database_id": "<你的 database id>"
    }
  ],
  "observability": { "enabled": true }
}
```

```jsonc
// package.json
{
  "name": "drink-run",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "db:local": "wrangler d1 execute drink-run --local --file=./schema.sql",
    "db:remote": "wrangler d1 execute drink-run --remote --file=./schema.sql"
  },
  "dependencies": { "hono": "^4" },
  "devDependencies": {
    "@cloudflare/workers-types": "^4",
    "typescript": "^5",
    "wrangler": "^4"
  }
}
```

---

## 6. 前端只要做對兩件事

```js
// 1) 每一次「送出」行為產生一個 requestId,retry 時沿用同一個。
//    重點:UUID 要在「使用者按下按鈕」時產生,不是在 fetch 裡產生。
async function submitOrder(eventId, payload) {
  const requestId = crypto.randomUUID();
  let bookmark = sessionStorage.getItem('d1_bookmark');

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`/api/events/${eventId}/orders`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': requestId,       // ← 同一個值重送
          ...(bookmark ? { 'x-d1-bookmark': bookmark } : {}),
        },
        body: JSON.stringify(payload),
      });

      // 2) 把 bookmark 存下來,之後的 GET 都帶上,才看得到自己剛下的單。
      const b = res.headers.get('x-d1-bookmark');
      if (b) sessionStorage.setItem('d1_bookmark', b);

      if (res.ok) return await res.json();          // 201 新單 / 200 重送,都算成功
      if (res.status === 409) return await res.json(); // 截止或額滿,不必 retry
      if (res.status < 500) throw new Error(await res.text());
    } catch (e) {
      if (attempt === 2) throw e;
    }
    await new Promise((r) => setTimeout(r, 150 * 2 ** attempt));
  }
}
```

倒數計時也用 server 的時鐘:`GET /api/events/:id` 會回 `server_now_ms`,前端算一次 offset,倒數用 `Date.now() + offset`。否則使用者手機慢 3 秒,他會在畫面顯示「還剩 2 秒」時送出,然後拿到 409,並且完全不知道為什麼。

---

## 7. 驗證:壓測腳本 + 不變量檢查

```js
// scripts/blast.mjs
// 用法:node scripts/blast.mjs <baseUrl> <eventId> [concurrency]
const [base, eventId, n = '200'] = process.argv.slice(2);
const N = Number(n);

// 情境 A:N 個不同使用者在同一毫秒送單
const fresh = Array.from({ length: N }, (_, i) =>
  fetch(`${base}/api/events/${eventId}/orders`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-user-id': `u${i}`,
      'x-user-name': `User ${i}`,
      'idempotency-key': crypto.randomUUID(),
    },
    body: JSON.stringify({ item: '珍奶微糖少冰', qty: 1 }),
  }).then((r) => r.status),
);

// 情境 B:同一個人連點 20 下(同一個 idempotency key)
const dupKey = crypto.randomUUID();
const dupes = Array.from({ length: 20 }, () =>
  fetch(`${base}/api/events/${eventId}/orders`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-user-id': 'clicky',
      'x-user-name': 'Clicky',
      'idempotency-key': dupKey,
    },
    body: JSON.stringify({ item: '紅茶拿鐵', qty: 2 }),
  }).then((r) => r.status),
);

const statuses = await Promise.all([...fresh, ...dupes]);
const tally = statuses.reduce((m, s) => ((m[s] = (m[s] ?? 0) + 1), m), {});
console.log('HTTP status 分佈:', tally);

const { event, orders } = await fetch(`${base}/api/events/${eventId}`).then((r) => r.json());
const sumQty = orders.reduce((s, o) => s + o.qty, 0);
const dupRows = orders.filter((o) => o.request_id === dupKey).length;

const checks = [
  ['計數器不脫節      cups_taken === Σqty', event.cups_taken === sumQty],
  ['沒有超賣          Σqty <= capacity',
    event.capacity == null || sumQty <= event.capacity],
  ['連點只產生一筆    dupRows === 1', dupRows === 1],
  ['沒有逾時單        every created_at < closes_at',
    orders.every((o) => o.created_at < event.closes_at)],
];
for (const [name, pass] of checks) console.log(pass ? 'PASS' : 'FAIL', name);
process.exit(checks.every(([, p]) => p) ? 0 : 1);
```

跑法:

```bash
npm run db:local && npx wrangler dev
# 另一個終端機:開一個 3 秒後截止、上限 30 杯的團,然後轟它
curl -s -XPOST localhost:8787/api/events -H 'x-user-id: host' \
  -H 'content-type: application/json' \
  -d "{\"title\":\"下午茶\",\"shop\":\"某某茶\",\"closesAt\":$(( $(date +%s000) + 3000 )),\"capacity\":30}"
node scripts/blast.mjs http://localhost:8787 <剛拿到的 id> 200
```

把 `placeOrder` 故意改成「先 SELECT 再 INSERT」再跑一次,四項會有兩到三項變成 FAIL——這是最快讓人相信單語句守衛不是多此一舉的方法。

---

## 8. 什麼時候 D1 不夠,要換 Durable Object

上面的做法在下列前提成立:

- **寫入吞吐**:所有寫入序列化在單一 D1 primary。揪團的量級(一團幾十到幾百筆、幾秒內湧入)綽綽有餘。若你要做的是幾千 QPS 打同一列的秒殺,單一 D1 資料庫會是瓶頸。
- **邏輯可以寫成單語句**:截止 + 容量 + 冪等都可以。一旦出現「要先讀 A 的結果才知道要不要寫 B」這種分支,D1 就做不到原子了(`batch()` 是交易但不能分支)。

這兩條任何一條破了,正確答案是 **Durable Object**:一個團一個 DO(`idFromName(eventId)`),DO 的單執行緒模型天然序列化所有請求,想寫多複雜的 read-then-write 都可以,並且可以用 DO 內建的 SQLite storage。D1 則留給跨團的報表查詢。

遷移成本不高,因為所有守衛邏輯已經集中在 `orders.ts`,換掉底層即可。

---

## 9. 這份程式碼刻意沒做的事

- **驗證**:`requireUser` 是 stub,請換成真的 JWT / LINE Login / Cloudflare Access。目前任何人送 `x-user-id` 標頭就能冒充別人。
- **冪等鍵過期回收**:`orders` 刪除後同一個 `request_id` 可以再用。要嚴格的話另開一張 `idempotency_keys` 表存回應快照。
- **限流**:同一個 IP / user 的送單頻率沒有限制。截止前的洪峰建議加 Cloudflare Rate Limiting rules,在 Worker 之前擋掉。
- **截止後的自動結算**:目前截止是「查詢時判斷」,不需要 cron。若你要在截止時推播通知,再加 Cron Trigger 掃 `closes_at` 剛過的團。
- **修改訂單**:只有新增與取消。要改內容,先取消再新增(trigger 已備妥 `orders_after_update_qty`,想直接支援 UPDATE 也行,但要記得容量守衛也得寫進 UPDATE 的 WHERE)。
