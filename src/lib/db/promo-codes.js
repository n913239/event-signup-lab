// 優惠碼。每人每活動一次:查本人在這個活動有沒有「有效訂單」用過這個碼(取消的不算,M2)。
export const findByCode = (db, code) =>
  db.prepare('SELECT code, discount_cents, valid_until, event_id FROM promo_codes WHERE code = ?').bind(code).first()

export async function usedBy(db, { memberId, eventId, code }) {
  const r = await db.prepare(`SELECT 1 FROM orders WHERE member_id = ? AND event_id = ? AND promo_code = ?
      AND status IN ('confirmed', 'checked_in') LIMIT 1`).bind(memberId, eventId, code).first()
  return !!r
}
