// 保留(Day 27)。規則由作者定(docs/spec.md「保留與確認的商業規則」,2026-09-27);程式由寫作 session 寫。
//
// 做法(R6 候選 a):一個 db.batch() 就是一個交易,任何一句拋錯整批回滾。
//   1. 還名額:這個活動所有「過期但還是 holding」的座位,把名額加回各自的票種(H4)
//   2. 翻過期:把它們翻成 expired —— 索引述詞看 status 不看時間,不翻就搶不到(docs/spec.md 座位釋放)
//   3. 插座位:裸 INSERT,撞 ux_seat_active → seat_taken、撞 ux_member_holding → hold_exists
//   4. 扣名額:扣到負數由 CHECK (remaining >= 0) 拋錯 → sold_out
// 座位在名額之前檢查,所以兩種都衝突時回 seat_taken(作者定)。

const RESTORE_EXPIRED = `UPDATE ticket_types SET remaining = remaining + (
    SELECT COUNT(*) FROM seat_holds s
     WHERE s.ticket_type_id = ticket_types.id AND s.status = 'holding' AND s.expires_at <= ?)
  WHERE event_id = ?`
const FLIP_EXPIRED = "UPDATE seat_holds SET status = 'expired' WHERE event_id = ? AND status = 'holding' AND expires_at <= ?"

// 把 D1 的約束錯誤翻成契約的錯誤代碼;不認得的原樣丟出去(500,不要吞掉)
function conflictOf(e) {
  const m = String(e?.message ?? e)
  if (/UNIQUE.*seat_holds\.event_id, seat_holds\.seat_no/.test(m)) return 'seat_taken'
  if (/UNIQUE.*seat_holds\.member_id, seat_holds\.event_id/.test(m)) return 'hold_exists'
  if (/CHECK constraint failed: remaining >= 0/.test(m)) return 'sold_out'
  throw e
}

export async function createHold(db, { eventId, memberId, ticketTypeId, seatNos, ttlMinutes }, now) {
  const holdId = crypto.randomUUID()
  const expiresAt = now + ttlMinutes * 60_000
  const stmts = [
    db.prepare(RESTORE_EXPIRED).bind(now, eventId),
    db.prepare(FLIP_EXPIRED).bind(eventId, now),
    ...seatNos.map((seatNo, seq) => db.prepare(`INSERT INTO seat_holds
        (id, hold_id, seq, event_id, seat_no, ticket_type_id, member_id, status, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'holding', ?, ?)`)
      .bind(crypto.randomUUID(), holdId, seq, eventId, seatNo, ticketTypeId, memberId, expiresAt, now)),
    db.prepare('UPDATE ticket_types SET remaining = remaining - ? WHERE id = ? AND event_id = ?')
      .bind(seatNos.length, ticketTypeId, eventId),
  ]
  let results
  try {
    results = await db.batch(stmts)
  } catch (e) {
    return { error: conflictOf(e) }
  }
  // 最後一句沒扣到(票種不屬於這個活動)時整批已經寫進去了 —— 呼叫端事先驗過票種,這裡是第二道
  if (results.at(-1).meta.changes !== 1) throw new Error('ticket type 不屬於此活動,名額未扣')
  return { hold: { id: holdId, event_id: eventId, ticket_type_id: ticketTypeId, seat_nos: [...seatNos], status: 'holding', expires_at: expiresAt } }
}

// 本人主動放棄:還名額、翻 cancelled。回 changes(0 = 不是本人的或早就不是 holding)。
export async function releaseHold(db, { holdId, memberId }, now) {
  const [, flip] = await db.batch([
    db.prepare(`UPDATE ticket_types SET remaining = remaining + (
        SELECT COUNT(*) FROM seat_holds WHERE hold_id = ? AND member_id = ? AND status = 'holding')
      WHERE id = (SELECT ticket_type_id FROM seat_holds WHERE hold_id = ? LIMIT 1)`).bind(holdId, memberId, holdId),
    db.prepare("UPDATE seat_holds SET status = 'cancelled' WHERE hold_id = ? AND member_id = ? AND status = 'holding'")
      .bind(holdId, memberId),
  ])
  return flip.meta.changes
}

// 排程:清掉沒有人來搶的過期 hold(三方競態裡的第三方)。回翻掉幾個座位。
export async function sweepExpired(db, now) {
  const [, flip] = await db.batch([
    db.prepare(`UPDATE ticket_types SET remaining = remaining + (
        SELECT COUNT(*) FROM seat_holds s
         WHERE s.ticket_type_id = ticket_types.id AND s.status = 'holding' AND s.expires_at <= ?)
      WHERE id IN (SELECT ticket_type_id FROM seat_holds WHERE status = 'holding' AND expires_at <= ?)`).bind(now, now),
    db.prepare("UPDATE seat_holds SET status = 'expired' WHERE status = 'holding' AND expires_at <= ?").bind(now),
  ])
  return flip.meta.changes
}

// 本人這個 hold 的座位列(不論狀態),confirm / DELETE 用
export async function findHold(db, holdId, memberId) {
  const r = await db.prepare(`SELECT hold_id, event_id, ticket_type_id, seat_no, status, expires_at, created_at
      FROM seat_holds WHERE hold_id = ? AND member_id = ? ORDER BY seq`).bind(holdId, memberId).all()
  if (r.results.length === 0) return null
  const h = r.results[0]
  return { id: h.hold_id, event_id: h.event_id, ticket_type_id: h.ticket_type_id, status: h.status,
    expires_at: h.expires_at, created_at: h.created_at, seat_nos: r.results.map((x) => x.seat_no) }
}
