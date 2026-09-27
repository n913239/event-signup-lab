// 訂單。金額欄只在確認那一次 INSERT 寫入,之後只改 status(規則 V、check-price-snapshot)。
const SELECT_ORDER = `SELECT o.id, o.event_id, e.name AS event_name, e.owner_id, o.member_id, o.status, o.hold_id,
    o.subtotal_cents, o.early_bird_pct, o.group_pct, o.promo_code, o.promo_cents, o.total_cents, o.confirmed_at,
    i.seat_no, i.ticket_type_id, t.name AS ticket_type_name, i.unit_price_cents
  FROM orders o JOIN events e ON e.id = o.event_id
  JOIN order_items i ON i.order_id = o.id JOIN ticket_types t ON t.id = i.ticket_type_id`

// 一次查詢,依訂單分組(SC-008:GET /orders 不做 N+1)
function group(rows) {
  const byId = new Map()
  for (const r of rows) {
    if (!byId.has(r.id)) {
      const { seat_no, ticket_type_id, ticket_type_name, unit_price_cents, ...head } = r
      byId.set(r.id, { ...head, items: [] })
    }
    byId.get(r.id).items.push({ seat_no: r.seat_no, ticket_type_id: r.ticket_type_id, ticket_type_name: r.ticket_type_name, unit_price_cents: r.unit_price_cents })
  }
  return [...byId.values()]
}

export async function listByMember(db, memberId) {
  const r = await db.prepare(`${SELECT_ORDER} WHERE o.member_id = ? ORDER BY o.confirmed_at DESC, o.id, i.seat_no`).bind(memberId).all()
  return group(r.results)
}

export async function findById(db, id) {
  const r = await db.prepare(`${SELECT_ORDER} WHERE o.id = ? ORDER BY i.seat_no`).bind(id).all()
  return group(r.results)[0] ?? null
}

export async function findByHold(db, holdId) {
  const row = await db.prepare('SELECT id FROM orders WHERE hold_id = ?').bind(holdId).first()
  return row ? findById(db, row.id) : null
}

// 確認:一個 batch。先把本人、未過期的 holding 翻成 confirmed(WHERE 帶 expires_at > now,到期那一刻就輸),
// 訂單與明細只在「全部座位都翻成功」時才插得進去。回 true = 成立。
// 優惠碼每人每活動一次的唯一索引撞到會拋錯,由呼叫端翻成 promo_rejected。
export async function insertConfirmed(db, { orderId, hold, memberId, unitPriceCents, quote, promoCode }, now) {
  const n = hold.seat_nos.length
  const [flip] = await db.batch([
    db.prepare(`UPDATE seat_holds SET status = 'confirmed'
        WHERE hold_id = ? AND member_id = ? AND status = 'holding' AND expires_at > ?`).bind(hold.id, memberId, now),
    db.prepare(`INSERT INTO orders (id, member_id, event_id, hold_id, status, subtotal_cents, early_bird_pct, group_pct,
          promo_code, promo_cents, total_cents, confirmed_at)
        SELECT ?, ?, ?, ?, 'confirmed', ?, ?, ?, ?, ?, ?, ?
        WHERE changes() = ?`)   // 只有「這一個 batch 的 UPDATE」真的翻成功才插;別的 confirm 先翻掉的不算(H7 併發)
      .bind(orderId, memberId, hold.event_id, hold.id, quote.subtotal_cents, quote.early_bird_pct, quote.group_pct,
        promoCode, quote.promo_cents, quote.total_cents, now, n),
    db.prepare(`INSERT INTO order_items (order_id, seat_no, ticket_type_id, unit_price_cents)
        SELECT ?, seat_no, ticket_type_id, ? FROM seat_holds
        WHERE hold_id = ? AND status = 'confirmed' AND EXISTS (SELECT 1 FROM orders WHERE id = ?)`)
      .bind(orderId, unitPriceCents, hold.id, orderId),
  ])
  return flip.meta.changes === n
}

// 本人取消 confirmed 的訂單:名額還回去(H4)、座位翻 cancelled(離開索引述詞 = 釋放)、訂單翻 cancelled。
// 訂單那句放最後:前兩句的子查詢靠它還是 confirmed。回 changes(0 = 不是本人的或不是 confirmed)。
export async function cancel(db, orderId, memberId) {
  const holdOf = "(SELECT hold_id FROM orders WHERE id = ? AND member_id = ? AND status = 'confirmed')"
  const results = await db.batch([
    db.prepare(`UPDATE ticket_types SET remaining = remaining + (
        SELECT COUNT(*) FROM seat_holds WHERE hold_id = ${holdOf} AND status = 'confirmed')
      WHERE id = (SELECT ticket_type_id FROM seat_holds WHERE hold_id = ${holdOf} LIMIT 1)`)
      .bind(orderId, memberId, orderId, memberId),
    db.prepare(`UPDATE seat_holds SET status = 'cancelled' WHERE hold_id = ${holdOf} AND status = 'confirmed'`)
      .bind(orderId, memberId),
    db.prepare("UPDATE orders SET status = 'cancelled' WHERE id = ? AND member_id = ? AND status = 'confirmed'")
      .bind(orderId, memberId),
  ])
  return results.at(-1).meta.changes
}
