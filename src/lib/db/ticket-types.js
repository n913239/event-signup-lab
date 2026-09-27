// ticket_types 的 SQL 存取。名額總和 ≤ 100 與「名額不得小於已售」都寫在 SQL 的 WHERE 裡,看 changes(規則 III)。
const COLS = 'id, event_id, name, price_cents, capacity, remaining, early_bird_until, early_bird_pct'

export async function create(db, eventId, v) {
  const id = crypto.randomUUID()
  const r = await db.prepare(`INSERT INTO ticket_types (${COLS})
    SELECT ?, ?, ?, ?, ?, ?, ?, ?
    WHERE (SELECT COALESCE(SUM(capacity), 0) FROM ticket_types WHERE event_id = ?) + ? <= 100`)
    .bind(id, eventId, v.name, v.price_cents, v.capacity, v.capacity, v.early_bird_until, v.early_bird_pct, eventId, v.capacity).run()
  return r.meta.changes === 1 ? findById(db, id) : null
}

export const findById = (db, id) => db.prepare(`SELECT ${COLS} FROM ticket_types WHERE id = ?`).bind(id).first()

export async function listByEvent(db, eventId) {
  return (await db.prepare(`SELECT ${COLS} FROM ticket_types WHERE event_id = ? ORDER BY price_cents, id`).bind(eventId).all()).results
}

export async function updatePrice(db, id, priceCents) {
  const r = await db.prepare('UPDATE ticket_types SET price_cents = ? WHERE id = ?').bind(priceCents, id).run()
  return r.meta.changes
}

