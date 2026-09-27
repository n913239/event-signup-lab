// 把 DB 列組成契約的 EventSummary / Event / EventDetail(openapi.yaml)。
export const summary = (e) => ({
  id: e.id, name: e.name, status: e.status, opens_at: e.opens_at, deadline_at: e.deadline_at, remaining_seats: e.remaining_seats,
})

export const event = (e) => ({
  ...summary(e), owner_id: e.owner_id, group_min_qty: e.group_min_qty, group_pct: e.group_pct, hold_ttl_minutes: e.hold_ttl_minutes,
})

export const detail = (e, { ticketTypes, seats, myHold, now }) => ({
  ...event(e), ticket_types: ticketTypes, seats, my_hold: myHold, server_now: now,
})
