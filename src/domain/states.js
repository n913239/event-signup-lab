// 狀態機(docs/spec.md):活動 draft → on_sale → closed → finished,不做 cancelled;
// hold / 訂單 holding → confirmed → checked_in,holding → expired | cancelled,confirmed → cancelled。
// checked_in / cancelled / expired 是終態。

const TRANSITIONS = {
  event: { draft: ['on_sale'], on_sale: ['closed'], closed: ['finished'], finished: [] },
  order: {
    holding: ['confirmed', 'expired', 'cancelled'],
    confirmed: ['cancelled', 'checked_in'],
    checked_in: [], cancelled: [], expired: [],
  },
}

export function canTransition(kind, from, to) {
  return TRANSITIONS[kind]?.[from]?.includes(to) ?? false
}
