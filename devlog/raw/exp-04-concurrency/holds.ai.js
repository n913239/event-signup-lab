// Seat holds on D1.
//
// D1 has no interactive transactions; `db.batch()` runs its statements as one
// transaction and rolls everything back if any statement throws. Every write
// path is therefore a single batch, and business failures (seat taken, hold
// exists, sold out) are surfaced as constraint violations that abort the batch:
//
//   - ux_seat_active     -> 'seat_taken'
//   - ux_member_holding  -> 'hold_exists'
//   - CHECK remaining>=0 -> 'sold_out'
//   - NOT NULL ticket_type_id (ticket type not in this event) -> 'sold_out'
//
// A hold is "live" while now < expires_at. Expired rows that still say
// 'holding' are flipped to 'expired' (and their quota returned) either by the
// next createHold on the same event, inside its own batch (FR-033), or by
// sweepExpired (FR-034). Rows are never deleted (FR-035).

const SEAT_RE = /^[A-J]([1-9]|10)$/;

// Returns quota of expired-but-still-holding rows to their ticket types.
// Must run before EXPIRE_* in the same batch, with the same `now`.
const RESTORE_EXPIRED_IN_EVENT = `
  UPDATE ticket_types
     SET remaining = MIN(capacity, remaining + (
           SELECT COUNT(*) FROM seat_holds s
            WHERE s.ticket_type_id = ticket_types.id
              AND s.event_id = ?1
              AND s.status = 'holding'
              AND s.expires_at <= ?2))
   WHERE id IN (
           SELECT ticket_type_id FROM seat_holds
            WHERE event_id = ?1 AND status = 'holding' AND expires_at <= ?2)`;

const EXPIRE_IN_EVENT = `
  UPDATE seat_holds SET status = 'expired'
   WHERE event_id = ?1 AND status = 'holding' AND expires_at <= ?2`;

const RESTORE_EXPIRED_ALL = `
  UPDATE ticket_types
     SET remaining = MIN(capacity, remaining + (
           SELECT COUNT(*) FROM seat_holds s
            WHERE s.ticket_type_id = ticket_types.id
              AND s.status = 'holding'
              AND s.expires_at <= ?1))
   WHERE id IN (
           SELECT ticket_type_id FROM seat_holds
            WHERE status = 'holding' AND expires_at <= ?1)`;

const EXPIRE_ALL = `
  UPDATE seat_holds SET status = 'expired'
   WHERE status = 'holding' AND expires_at <= ?1`;

function validateCreateInput({ eventId, memberId, ticketTypeId, seatNos, ttlMinutes }, now) {
  if (!eventId || !memberId || !ticketTypeId) {
    throw new TypeError('eventId, memberId and ticketTypeId are required');
  }
  if (!Array.isArray(seatNos) || seatNos.length === 0) {
    throw new TypeError('seatNos must be a non-empty array');
  }
  if (new Set(seatNos).size !== seatNos.length) {
    throw new TypeError('seatNos must not contain duplicates');
  }
  for (const s of seatNos) {
    if (typeof s !== 'string' || !SEAT_RE.test(s)) {
      throw new TypeError(`invalid seat number: ${s}`);
    }
  }
  if (!Number.isInteger(ttlMinutes) || ttlMinutes <= 0) {
    throw new TypeError('ttlMinutes must be a positive integer');
  }
  if (!Number.isInteger(now)) {
    throw new TypeError('now must be epoch milliseconds');
  }
}

function errorText(err) {
  return [err?.message, err?.cause?.message].filter(Boolean).join(' ');
}

function mapConstraintError(err) {
  const msg = errorText(err);
  if (!/constraint failed/i.test(msg)) return null;
  if (/UNIQUE/i.test(msg)) {
    if (/seat_no/.test(msg)) return 'seat_taken';
    if (/member_id/.test(msg)) return 'hold_exists';
    return null;
  }
  // Seat format is validated up front, so the only CHECK that can fire here
  // is remaining >= 0; NOT NULL fires when the ticket type isn't in the event.
  if (/CHECK/i.test(msg)) return 'sold_out';
  if (/NOT NULL/i.test(msg) && /ticket_type_id/.test(msg)) return 'sold_out';
  return null;
}

export async function createHold(db, input, now) {
  validateCreateInput(input, now);
  const { eventId, memberId, ticketTypeId, seatNos, ttlMinutes } = input;
  const expiresAt = now + ttlMinutes * 60_000;
  const holdId = crypto.randomUUID();
  const n = seatNos.length;

  // Fast path so a member with a live hold gets 'hold_exists' rather than
  // whichever unique index SQLite happens to check first. Not relied on for
  // correctness: ux_member_holding enforces it inside the batch.
  const live = await db
    .prepare(
      `SELECT 1 FROM seat_holds
        WHERE member_id = ?1 AND event_id = ?2 AND status = 'holding'
          AND seq = 0 AND expires_at > ?3
        LIMIT 1`
    )
    .bind(memberId, eventId, now)
    .first();
  if (live) return { error: 'hold_exists' };

  const stmts = [
    // FR-033: release expired holds in this event within the same transaction
    // that grabs the seats, so a lapsed hold never blocks anyone.
    db.prepare(RESTORE_EXPIRED_IN_EVENT).bind(eventId, now),
    db.prepare(EXPIRE_IN_EVENT).bind(eventId, now),
    // Take quota; CHECK (remaining >= 0) aborts the batch when short.
    db
      .prepare(
        `UPDATE ticket_types SET remaining = remaining - ?1
          WHERE id = ?2 AND event_id = ?3`
      )
      .bind(n, ticketTypeId, eventId),
  ];

  seatNos.forEach((seatNo, seq) => {
    stmts.push(
      db
        .prepare(
          `INSERT INTO seat_holds
             (id, hold_id, seq, event_id, seat_no, ticket_type_id,
              member_id, status, expires_at, created_at)
           VALUES (?1, ?2, ?3, ?4, ?5,
                   (SELECT id FROM ticket_types WHERE id = ?6 AND event_id = ?4),
                   ?7, 'holding', ?8, ?9)`
        )
        .bind(crypto.randomUUID(), holdId, seq, eventId, seatNo, ticketTypeId,
              memberId, expiresAt, now)
    );
  });

  try {
    await db.batch(stmts);
  } catch (err) {
    const code = mapConstraintError(err);
    if (code) return { error: code };
    throw err;
  }

  return {
    hold: {
      id: holdId,
      event_id: eventId,
      ticket_type_id: ticketTypeId,
      seat_nos: [...seatNos],
      status: 'holding',
      expires_at: expiresAt,
    },
  };
}

export async function releaseHold(db, { holdId, memberId }, now) {
  // Only a live hold can be released; one that has lapsed is left for the
  // next grab or sweep to mark 'expired'.
  const [, res] = await db.batch([
    db
      .prepare(
        `UPDATE ticket_types
            SET remaining = MIN(capacity, remaining + (
                  SELECT COUNT(*) FROM seat_holds s
                   WHERE s.ticket_type_id = ticket_types.id
                     AND s.hold_id = ?1 AND s.member_id = ?2
                     AND s.status = 'holding' AND s.expires_at > ?3))
          WHERE id IN (
                  SELECT ticket_type_id FROM seat_holds
                   WHERE hold_id = ?1 AND member_id = ?2
                     AND status = 'holding' AND expires_at > ?3)`
      )
      .bind(holdId, memberId, now),
    db
      .prepare(
        `UPDATE seat_holds SET status = 'cancelled'
          WHERE hold_id = ?1 AND member_id = ?2
            AND status = 'holding' AND expires_at > ?3`
      )
      .bind(holdId, memberId, now),
  ]);
  return res.meta.changes ?? 0;
}

export async function sweepExpired(db, now) {
  const [, res] = await db.batch([
    db.prepare(RESTORE_EXPIRED_ALL).bind(now),
    db.prepare(EXPIRE_ALL).bind(now),
  ]);
  return res.meta.changes ?? 0;
}

export async function findHold(db, holdId, memberId) {
  const { results } = await db
    .prepare(
      `SELECT hold_id, event_id, ticket_type_id, status, expires_at,
              created_at, seat_no
         FROM seat_holds
        WHERE hold_id = ?1 AND member_id = ?2
        ORDER BY seq`
    )
    .bind(holdId, memberId)
    .all();
  if (!results || results.length === 0) return null;

  const head = results[0];
  return {
    id: head.hold_id,
    event_id: head.event_id,
    ticket_type_id: head.ticket_type_id,
    status: head.status,
    expires_at: head.expires_at,
    created_at: head.created_at,
    seat_nos: results.map((r) => r.seat_no),
  };
}
