// events 的 SQL 存取。座位狀態由 seat_holds 推導,不存座位表。
export async function create(db, ownerId, v, now) {
  const id = crypto.randomUUID()
  await db.prepare(`INSERT INTO events (id, owner_id, name, opens_at, deadline_at, status, group_min_qty, group_pct, hold_ttl_minutes, created_at)
    VALUES (?, ?, ?, ?, ?, 'on_sale', ?, ?, ?, ?)`)
    .bind(id, ownerId, v.name, v.opens_at, v.deadline_at, v.group_min_qty, v.group_pct, v.hold_ttl_minutes, now).run()
  return findById(db, id, now)
}

// 剩餘座位 = 100 − (有效 holding + confirmed)。過期但還沒翻狀態的 holding 視同不存在。
const REMAINING = `100 - (SELECT COUNT(*) FROM seat_holds s WHERE s.event_id = e.id
  AND (s.status = 'confirmed' OR (s.status = 'holding' AND s.expires_at > ?)))`
const COLS = `e.id, e.owner_id, e.name, e.opens_at, e.deadline_at, e.status, e.group_min_qty, e.group_pct, e.hold_ttl_minutes`

export const findById = (db, id, now) =>
  db.prepare(`SELECT ${COLS}, ${REMAINING} AS remaining_seats FROM events e WHERE e.id = ?`).bind(now, id).first()

// draft 只給主辦看(規格層決定 11)。
export async function list(db, { status, viewerId }, now) {
  const where = ["(e.status != 'draft' OR e.owner_id = ?)"]
  const args = [now, viewerId]
  if (status) { where.push('e.status = ?'); args.push(status) }
  const r = await db.prepare(`SELECT ${COLS}, ${REMAINING} AS remaining_seats FROM events e
    WHERE ${where.join(' AND ')} ORDER BY e.opens_at, e.id`).bind(...args).all()
  return r.results
}

const PATCHABLE = ['name', 'opens_at', 'deadline_at', 'hold_ttl_minutes', 'group_min_qty', 'group_pct']

// 改活動欄位 + 各票種名額,同一個 batch(全有全無,T081)。
// 名額的合法性(不小於已售、總和 ≤ 100)由呼叫端先驗;這裡的第二道是 CHECK (remaining >= 0) 與 opens_at < deadline_at —
// 同時有人搶到座位讓「已售」變多時,remaining 扣到負數會拋錯,整批回滾。
export async function updateWithCapacities(db, id, ownerId, v, capacities) {
  const keys = PATCHABLE.filter((k) => v[k] !== undefined)
  const stmts = []
  if (keys.length) {
    stmts.push(db.prepare(`UPDATE events SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ? AND owner_id = ?`)
      .bind(...keys.map((k) => v[k]), id, ownerId))
  }
  for (const { id: ttId, capacity } of capacities) {
    stmts.push(db.prepare('UPDATE ticket_types SET remaining = remaining + (? - capacity), capacity = ? WHERE id = ? AND event_id = ?')
      .bind(capacity, capacity, ttId, id))
  }
  if (stmts.length === 0) return true
  const results = await db.batch(stmts)
  return results.every((r) => r.meta.changes === 1)
}

export async function close(db, id, ownerId) {
  const r = await db.prepare("UPDATE events SET status = 'closed' WHERE id = ? AND owner_id = ? AND status = 'on_sale'")
    .bind(id, ownerId).run()
  return r.meta.changes
}

const ROWS = 'ABCDEFGHIJ'
export const SEAT_NOS = [...ROWS].flatMap((r) => Array.from({ length: 10 }, (_, i) => `${r}${i + 1}`))

// 100 席狀態:有效 holding = held、confirmed = sold,本人的都是 mine。
export async function seatMap(db, eventId, viewerId, now) {
  const r = await db.prepare(`SELECT seat_no, status, member_id, ticket_type_id FROM seat_holds
    WHERE event_id = ? AND (status = 'confirmed' OR (status = 'holding' AND expires_at > ?))`).bind(eventId, now).all()
  const taken = new Map(r.results.map((s) => [s.seat_no, s]))
  return SEAT_NOS.map((seat_no) => {
    const s = taken.get(seat_no)
    if (!s) return { seat_no, state: 'free', ticket_type_id: null }
    const state = s.member_id === viewerId ? 'mine' : s.status === 'confirmed' ? 'sold' : 'held'
    return { seat_no, state, ticket_type_id: s.ticket_type_id }
  })
}

// 本人在這個活動的有效 hold(契約的 Hold 形狀,server_now 由呼叫端補)。
export async function findActiveHold(db, eventId, memberId, now) {
  const r = await db.prepare(`SELECT hold_id, ticket_type_id, seat_no, expires_at FROM seat_holds
    WHERE event_id = ? AND member_id = ? AND status = 'holding' AND expires_at > ? ORDER BY seq`)
    .bind(eventId, memberId, now).all()
  if (r.results.length === 0) return null
  const h = r.results[0]
  return { id: h.hold_id, event_id: eventId, ticket_type_id: h.ticket_type_id, seat_nos: r.results.map((x) => x.seat_no), status: 'holding', expires_at: h.expires_at }
}

// 排程:過了 deadline_at + hold_ttl_minutes 的活動轉 finished(Q24,作者 2026-09-27 定)。
// 狀態機沒有 on_sale → finished,所以先把 on_sale 的 close,再把 closed 的 finish,同一個 batch。回轉成 finished 的數量。
export async function finishPastDeadline(db, now) {
  const past = 'deadline_at + hold_ttl_minutes * 60000 <= ?'
  const [, finish] = await db.batch([
    db.prepare(`UPDATE events SET status = 'closed' WHERE status = 'on_sale' AND ${past}`).bind(now),
    db.prepare(`UPDATE events SET status = 'finished' WHERE status = 'closed' AND ${past}`).bind(now),
  ])
  return finish.meta.changes
}
