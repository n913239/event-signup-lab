# 揪團訂飲料 — 「跟單要檢查截止時間」實作

環境:Cloudflare Workers + Hono(後端)、一般網頁前端。
資料庫以 D1 (SQLite) 為例;換成 KV / Durable Object 的差異寫在最後一節。

---

## 0. 先定調三件事

這段邏輯真正的難處不在「比大小」,而在下面三個決定。程式碼只是這三個決定的結果。

1. **時間的唯一權威在後端。** 前端的倒數計時、按鈕變灰,全部只是 UX 提示。
   使用者的電腦時鐘可能慢五分鐘,也可能自己開 devtools 把按鈕的 `disabled` 拿掉。
   凡是「不能做」的判斷,一定要在 handler 裡再做一次。
2. **時間一律存 UTC epoch 毫秒(整數)。** 不要存 `'2026-08-27 18:00'` 這種字串。
   揪團一定會遇到跨時區(有人在出差)與日光節約的邊界,存字串遲早出事。
   顯示成「今天 18:00」是前端的責任,用 `Intl.DateTimeFormat` 轉。
3. **「截止」不等於「時間到」。** 團主可能提早手動關單、店家臨時公休、團被取消。
   所以狀態要是 `status`,而 `deadline_at` 只是自動讓 `status` 失效的其中一個條件。
   如果只判斷 `now < deadline_at`,之後要加「提早關單」就得改動所有呼叫點。

---

## 1. Schema

```sql
CREATE TABLE groups (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  shop_name    TEXT NOT NULL,
  owner_id     TEXT NOT NULL,
  -- UTC epoch millis。整數,方便直接比大小,也不會有時區歧義
  deadline_at  INTEGER NOT NULL,
  -- 'open' | 'closed' | 'cancelled'
  -- closed 可能來自時間到,也可能來自團主手動關單
  status       TEXT NOT NULL DEFAULT 'open',
  closed_at    INTEGER,
  created_at   INTEGER NOT NULL
);

CREATE TABLE orders (
  id         TEXT PRIMARY KEY,
  group_id   TEXT NOT NULL REFERENCES groups(id),
  user_id    TEXT NOT NULL,
  item_name  TEXT NOT NULL,
  size       TEXT,
  sugar      TEXT,
  ice        TEXT,
  qty        INTEGER NOT NULL DEFAULT 1,
  note       TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_orders_group ON orders(group_id);
-- 開團列表常用:還沒截止的團
CREATE INDEX idx_groups_open ON groups(status, deadline_at);
```

`status` 用 `open` 當預設,**不需要**排程工作去把過期的團改成 `closed`。
判斷式是 `status = 'open' AND deadline_at > now`,兩個條件同時成立才算開著。
排程只是為了讓列表查詢好看,不是正確性的依賴。

---

## 2. 共用的判斷:一個地方定義「還能不能跟單」

```ts
// src/lib/group-state.ts

export type GroupRow = {
  id: string;
  title: string;
  deadline_at: number;
  status: 'open' | 'closed' | 'cancelled';
  closed_at: number | null;
};

export type ClosedReason = 'DEADLINE_PASSED' | 'CLOSED_BY_OWNER' | 'CANCELLED';

export type GroupState =
  | { open: true }
  | { open: false; reason: ClosedReason };

/**
 * 單一判斷點。所有「這個團還能不能動」的地方都呼叫這個,
 * 不要在各個 handler 裡各寫各的 if。
 */
export function groupState(g: GroupRow, now: number): GroupState {
  if (g.status === 'cancelled') return { open: false, reason: 'CANCELLED' };
  if (g.status === 'closed')    return { open: false, reason: 'CLOSED_BY_OWNER' };
  if (now >= g.deadline_at)     return { open: false, reason: 'DEADLINE_PASSED' };
  return { open: true };
}

export const CLOSED_MESSAGE: Record<ClosedReason, string> = {
  DEADLINE_PASSED: '這一團已經截止了',
  CLOSED_BY_OWNER: '團主已經提早關單',
  CANCELLED:       '這一團已取消',
};
```

邊界用 `now >= deadline_at` 算截止。也就是說 `deadline_at` 是**第一個不能跟單的瞬間**,
半開區間 `[created, deadline)`。這點要在 API 文件寫死,不然前端倒數到 0 的那一秒會跟後端吵架。

---

## 3. Hono handler

### 3.1 錯誤格式先統一

```ts
// src/lib/errors.ts
import type { Context } from 'hono';

export function closedResponse(
  c: Context,
  group: { id: string; deadline_at: number },
  reason: ClosedReason,
  now: number,
) {
  // 409 而不是 403:這不是「你沒權限」,是「資源目前的狀態不允許」。
  // 前端據此決定要重新拉一次團的狀態,而不是把使用者踢去登入。
  return c.json(
    {
      error: {
        code: 'GROUP_CLOSED',
        reason,                       // 讓前端顯示不同文案
        message: CLOSED_MESSAGE[reason],
        deadline_at: group.deadline_at,
        server_now: now,              // 前端拿來校正自己的時鐘偏移
      },
    },
    409,
  );
}
```

`server_now` 是關鍵欄位。使用者最常抱怨的情境是「我明明看到還有 30 秒」,
原因幾乎都是他的電腦時鐘偏掉。把伺服器時間一起回去,前端就能自我修正(見第 4 節)。

### 3.2 跟單 handler

```ts
// src/routes/orders.ts
import { Hono } from 'hono';
import { z } from 'zod';
import { groupState, CLOSED_MESSAGE } from '../lib/group-state';
import { closedResponse } from '../lib/errors';

type Env = { Bindings: { DB: D1Database } };

const createOrderSchema = z.object({
  item_name: z.string().min(1).max(50),
  size:  z.enum(['M', 'L']).optional(),
  sugar: z.enum(['no', 'quarter', 'half', 'less', 'full']).optional(),
  ice:   z.enum(['hot', 'no', 'light', 'less', 'full']).optional(),
  qty:   z.number().int().min(1).max(10).default(1),
  note:  z.string().max(100).optional(),
});

export const orders = new Hono<Env>();

orders.post('/groups/:groupId/orders', async (c) => {
  const groupId = c.req.param('groupId');
  const userId = c.get('userId');            // 來自你的 auth middleware

  const parsed = createOrderSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: { code: 'INVALID_BODY', issues: parsed.error.issues } }, 400);
  }
  const body = parsed.data;

  // 注意:body 裡「絕對不接受」任何客戶端傳來的時間戳。
  // 若前端送了 created_at / client_time,一律忽略。
  const now = Date.now();

  const group = await c.env.DB
    .prepare('SELECT id, title, deadline_at, status, closed_at FROM groups WHERE id = ?')
    .bind(groupId)
    .first<GroupRow>();

  if (!group) {
    return c.json({ error: { code: 'GROUP_NOT_FOUND' } }, 404);
  }

  // 先做一次「便宜」的檢查,好回傳精確的 reason 給前端顯示。
  const state = groupState(group, now);
  if (!state.open) {
    return closedResponse(c, group, state.reason, now);
  }

  // 真正的把關在這裡:把條件寫進 INSERT 的 WHERE,讓資料庫來仲裁。
  // 上面那次 SELECT 到這行之間有時間差(可能只有幾毫秒,但截止瞬間就是會撞上),
  // 而且團主的「提早關單」可能剛好在這個縫隙裡發生。
  const id = crypto.randomUUID();
  const res = await c.env.DB
    .prepare(
      `INSERT INTO orders
         (id, group_id, user_id, item_name, size, sugar, ice, qty, note, created_at, updated_at)
       SELECT ?, g.id, ?, ?, ?, ?, ?, ?, ?, ?, ?
         FROM groups g
        WHERE g.id = ?
          AND g.status = 'open'
          AND g.deadline_at > ?`,
    )
    .bind(
      id, userId, body.item_name, body.size ?? null, body.sugar ?? null,
      body.ice ?? null, body.qty, body.note ?? null, now, now,
      groupId, now,
    )
    .run();

  if (res.meta.changes === 0) {
    // 走到這裡代表在 SELECT 之後團被關掉了。重讀一次拿正確的 reason。
    const fresh = await c.env.DB
      .prepare('SELECT id, title, deadline_at, status, closed_at FROM groups WHERE id = ?')
      .bind(groupId)
      .first<GroupRow>();
    const s = fresh ? groupState(fresh, Date.now()) : ({ open: false, reason: 'CANCELLED' } as const);
    return closedResponse(c, fresh ?? group, s.open ? 'DEADLINE_PASSED' : s.reason, Date.now());
  }

  return c.json({ order: { id, group_id: groupId, ...body, created_at: now } }, 201);
});
```

**為什麼要有 `INSERT ... SELECT ... WHERE` 這一層?**

先 SELECT 再 INSERT 是典型的 TOCTOU(check-time to use-time)。兩件事會鑽這個縫:

- 剛好卡在截止那一毫秒的請求。人數多的時候(下午三點大家一起搶)真的會撞到。
- 團主按「提早關單」的同一瞬間,別人正在送出跟單。

把條件塞進 SQL 的 `WHERE`,插入與檢查就變成同一個原子操作,縫隙消失。
`meta.changes === 0` 就是「條件不成立,沒插進去」。

### 3.3 改單與刪單走同一套

最容易漏的地方。截止之後不能新增,自然也不能改自己已經下的單
(不然團主已經去買了,你把珍奶改成四杯)。

```ts
orders.patch('/groups/:groupId/orders/:orderId', async (c) => {
  const { groupId, orderId } = c.req.param();
  const userId = c.get('userId');
  const body = createOrderSchema.partial().parse(await c.req.json());
  const now = Date.now();

  const res = await c.env.DB
    .prepare(
      `UPDATE orders
          SET item_name = COALESCE(?, item_name),
              qty       = COALESCE(?, qty),
              note      = COALESCE(?, note),
              updated_at = ?
        WHERE id = ? AND group_id = ? AND user_id = ?
          AND EXISTS (
            SELECT 1 FROM groups g
             WHERE g.id = ? AND g.status = 'open' AND g.deadline_at > ?
          )`,
    )
    .bind(
      body.item_name ?? null, body.qty ?? null, body.note ?? null, now,
      orderId, groupId, userId, groupId, now,
    )
    .run();

  if (res.meta.changes === 0) {
    // 可能是:單不存在 / 不是你的單 / 團已截止。分辨清楚再回。
    const group = await c.env.DB
      .prepare('SELECT id, title, deadline_at, status, closed_at FROM groups WHERE id = ?')
      .bind(groupId).first<GroupRow>();
    if (group) {
      const s = groupState(group, Date.now());
      if (!s.open) return closedResponse(c, group, s.reason, Date.now());
    }
    return c.json({ error: { code: 'ORDER_NOT_FOUND' } }, 404);
  }
  return c.json({ ok: true });
});
```

DELETE 同理,`WHERE` 裡掛同一個 `EXISTS`。

實務上可以考慮一個小小的**寬限期**:改單允許在截止後 60 秒內完成(手滑打錯字的補救),
新增則一秒都不寬限。若要這樣做,把寬限秒數寫成常數,不要散在各處:

```ts
export const EDIT_GRACE_MS = 60_000;   // 改/刪單的寬限
export const JOIN_GRACE_MS = 0;        // 新增不寬限
```

### 3.4 讀團資訊時一併回傳伺服器時間

前端要對時,得有東西可以對。

```ts
groups.get('/groups/:id', async (c) => {
  const g = await c.env.DB.prepare('SELECT * FROM groups WHERE id = ?')
    .bind(c.req.param('id')).first<GroupRow>();
  if (!g) return c.json({ error: { code: 'GROUP_NOT_FOUND' } }, 404);

  const now = Date.now();
  const state = groupState(g, now);
  return c.json({
    group: {
      ...g,
      is_open: state.open,
      closed_reason: state.open ? null : state.reason,
    },
    server_now: now,   // ← 前端校時用
  });
});
```

順手也可以在每個回應加一個 header,讓所有頁面都能對時:

```ts
app.use('*', async (c, next) => {
  await next();
  c.header('X-Server-Time', String(Date.now()));
});
```

### Workers 的時間小陷阱

Cloudflare Workers 為了防側通道攻擊,`Date.now()` **在兩次 I/O 之間是凍結的**——
回傳的是「上一次 I/O 完成時的時間」。所以你在 handler 開頭跟結尾各叫一次 `Date.now()`,
中間沒做 I/O 的話會拿到一模一樣的值。

對截止判斷來說完全沒問題(誤差在毫秒級,而截止時間的粒度是分鐘),
但別拿它來量測程式碼區段的耗時,量出來會是 0。

---

## 4. 前端怎麼配合

前端要做三件事,重要性由高到低:**校時 → 倒數與鎖 UI → 處理 409**。
只做前兩件會有 bug,只做第三件則體驗很差。

### 4.1 校時:算出本機時鐘的偏移

```js
// src/lib/clock.js
let skew = 0;   // serverNow - clientNow

export function syncClock(serverNow, requestStartedAt) {
  // 扣掉來回網路延遲的一半,粗略但夠用
  const rtt = Date.now() - requestStartedAt;
  skew = serverNow + rtt / 2 - Date.now();
}

/** 伺服器視角的「現在」 */
export function serverNow() {
  return Date.now() + skew;
}
```

```js
export async function fetchGroup(id) {
  const t0 = Date.now();
  const res = await fetch(`/api/groups/${id}`);
  const data = await res.json();
  syncClock(data.server_now, t0);
  return data.group;
}
```

之後**所有**倒數計算都用 `serverNow()`,不要再直接用 `Date.now()`。
這一步做了,「我明明還看得到按鈕」的客訴會少掉九成。

### 4.2 倒數與鎖 UI

```js
// src/components/deadline.js
import { serverNow } from '../lib/clock.js';

export function mountDeadline(group, { onExpire }) {
  const el = document.querySelector('#countdown');
  const btn = document.querySelector('#join-btn');
  let expired = false;

  function tick() {
    const left = group.deadline_at - serverNow();

    if (left <= 0) {
      el.textContent = '已截止';
      el.classList.add('expired');
      if (!expired) {
        expired = true;
        lock('這一團已經截止了');
        onExpire?.();          // 通常是重新拉一次團的狀態
      }
      return;
    }

    const s = Math.floor(left / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    el.textContent = `剩下 ${Math.floor(s / 3600)
      ? Math.floor(s / 3600) + ' 小時 ' : ''}${mm}:${ss}`;

    // 最後五分鐘變色提醒
    el.classList.toggle('urgent', left <= 5 * 60 * 1000);
  }

  function lock(msg) {
    btn.disabled = true;
    btn.textContent = msg;
  }

  tick();
  const timer = setInterval(tick, 1000);

  // 手機切回前景 / 電腦從睡眠醒來時,setInterval 會落後很多,
  // 這時要立刻補算一次,而且順便跟後端重新對時。
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { tick(); onExpire?.(); }
  });

  return () => clearInterval(timer);
}
```

`visibilitychange` 那段不能省。手機鎖屏十分鐘再打開,`setInterval` 在背景被節流甚至暫停,
畫面上會停在十分鐘前的秒數,使用者照著那個數字按下去,然後收到 409 覺得莫名其妙。

### 4.3 送出時處理 409

即使 UI 已經鎖了,送出還是可能撞到截止(按下去的瞬間剛好跨過)。
所以送出路徑一定要能優雅地處理 `GROUP_CLOSED`。

```js
export async function submitOrder(groupId, payload) {
  const res = await fetch(`/api/groups/${groupId}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (res.status === 409) {
    const { error } = await res.json();
    if (error.code === 'GROUP_CLOSED') {
      // 1. 用後端給的時間重新對時,修正本機偏移
      syncClock(error.server_now, Date.now());
      // 2. 鎖住 UI,不要讓他再按一次收到一樣的錯誤
      lockUI(error.message);
      // 3. 把他填的內容留在表單裡,別清掉——
      //    如果團主等一下重開團,他不用重打一次
      showToast(error.message);
      return { ok: false, reason: error.reason };
    }
  }

  if (!res.ok) {
    showToast('送出失敗,請再試一次');
    return { ok: false, reason: 'UNKNOWN' };
  }

  return { ok: true, order: (await res.json()).order };
}
```

三個細節:

- **不要清空表單。** 收到「已截止」就把使用者打的珍奶去冰半糖清掉,是二次傷害。
- **按鈕要進入永久 disabled**,不是「再試一次」。這個錯誤重試一百次結果都一樣。
- **`reason` 分開處理文案。** 「時間到了」跟「團主提早關單」對使用者是不同的事,
  後者他可能會想去問團主一句。

### 4.4 送出中要防重複點擊

跟截止時間相關的常見副作用:使用者在最後一秒瘋狂點送出,結果送出三筆。

```js
btn.addEventListener('click', async () => {
  if (btn.disabled) return;
  btn.disabled = true;                       // 先鎖,再送
  try {
    const r = await submitOrder(groupId, readForm());
    if (!r.ok && r.reason !== 'DEADLINE_PASSED') btn.disabled = false;  // 可重試的才解鎖
  } catch (e) {
    btn.disabled = false;
  }
});
```

後端若要更保險,可以在 `orders` 上加 `UNIQUE(group_id, user_id, item_name, size, sugar, ice)`
之類的約束,或是接受前端傳來的 idempotency key。看你們允不允許同一人點兩杯一樣的。

---

## 5. 測試時一定要蓋到的案例

```
□ 截止前 1 秒跟單 → 201
□ 截止當下那一毫秒(now === deadline_at)→ 409,且與文件說的半開區間一致
□ 截止後 1 秒 → 409 DEADLINE_PASSED
□ 團主提早關單後 → 409 CLOSED_BY_OWNER(而不是 DEADLINE_PASSED)
□ 截止後改自己的單 → 409(這格最常漏)
□ 截止後刪自己的單 → 409
□ 前端時鐘故意調快 10 分鐘 → 倒數仍正確(校時生效)
□ 前端時鐘故意調慢 10 分鐘 → 按下去拿到 409 且 UI 正確鎖住
□ 直接用 curl 打 API(繞過前端)→ 一樣被擋
□ 團不存在 → 404 而不是 409
```

倒數第二格是驗收的重點:如果 curl 打得進去,前面所有前端工都白做了。

測試時把 `Date.now()` 抽成可注入的 `now()`,handler 從 context 拿,
就不用真的等到截止時間才能測。

---

## 6. 換成別的儲存後端

- **KV**:沒有條件寫入,最終一致,**不適合**當截止時間的仲裁者。
  邊界那一瞬間會漏單,而且你讀到的可能是舊值。要用 KV 就只能拿它當快取。
- **Durable Object**:天生序列化執行,原子性直接成立,不需要 `INSERT ... WHERE` 的技巧。
  一個團一個 DO,把 `deadline_at` 放在 DO 的 storage 裡,順便可以用
  `state.storage.setAlarm(deadline_at)` 在截止瞬間自動結算、推播通知團主。
  團數多、每團同時下單的人也多的話,這是比 D1 更貼的模型。
- **D1**:如上,靠 SQL 的 `WHERE` 做原子判斷就夠了,是最省事的起點。

---

## 7. 一句話總結

前端的倒數與變灰按鈕負責「不要讓人白按」,後端的 `INSERT ... WHERE status='open' AND deadline_at > ?`
負責「按了也沒用」。兩者都要,而且只有後面那個是正確性的來源。
