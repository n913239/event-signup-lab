// 輸入驗證(data-model.md「驗證規則」)。純邏輯:回 { ok: true, value } 或 { ok: false, error: 'invalid_input' }。
// 錯誤不細分哪一欄 —— 「錯誤訊息不友善」是刻意保留的醜(non-goals)。

const BAD = Object.freeze({ ok: false, error: 'invalid_input' })
const ok = (value) => ({ ok: true, value })
const isObj = (b) => b !== null && typeof b === 'object' && !Array.isArray(b)
const str = (v, min, max) => typeof v === 'string' && v.length >= min && v.length <= max
const int = (v, min = -Infinity, max = Infinity) => Number.isInteger(v) && v >= min && v <= max
const SEAT = /^[A-J](10|[1-9])$/

export function register(b) {
  if (!isObj(b) || !str(b.email, 3, 254) || !b.email.includes('@')) return BAD
  if (!str(b.password, 8, Infinity) || !str(b.nickname, 1, 50)) return BAD
  return ok({ email: b.email.toLowerCase(), password: b.password, nickname: b.nickname })
}

export function login(b) {
  if (!isObj(b) || typeof b.email !== 'string' || typeof b.password !== 'string') return BAD
  return ok({ email: b.email.toLowerCase(), password: b.password })
}

const EVENT_FIELDS = {
  name: (v) => str(v, 1, 100),
  opens_at: (v) => int(v, 0),
  deadline_at: (v) => int(v, 0),
  group_min_qty: (v) => int(v, 2),
  group_pct: (v) => int(v, 0, 100),
  hold_ttl_minutes: (v) => int(v, 5, 30),
}

export function eventCreate(b) {
  if (!isObj(b)) return BAD
  const v = { group_min_qty: 4, group_pct: 10, hold_ttl_minutes: 10, ...pick(b, Object.keys(EVENT_FIELDS)) }
  for (const [k, check] of Object.entries(EVENT_FIELDS)) if (!check(v[k])) return BAD
  if (v.opens_at >= v.deadline_at) return BAD
  return ok(v)
}

// PATCH 只驗有給的欄位;opens_at < deadline_at 要跟現有值合併後才能判斷,由 route 再檢一次。
export function eventPatch(b) {
  if (!isObj(b)) return BAD
  const v = pick(b, ['name', 'opens_at', 'deadline_at', 'hold_ttl_minutes'])
  if (Object.keys(v).length === 0) return BAD
  for (const [k, val] of Object.entries(v)) if (!EVENT_FIELDS[k](val)) return BAD
  if (v.opens_at !== undefined && v.deadline_at !== undefined && v.opens_at >= v.deadline_at) return BAD
  return ok(v)
}

export function ticketTypeCreate(b) {
  if (!isObj(b)) return BAD
  const v = { early_bird_until: null, early_bird_pct: 0, ...pick(b, ['name', 'price_cents', 'capacity', 'early_bird_until', 'early_bird_pct']) }
  if (!str(v.name, 1, 100) || !int(v.price_cents, 0) || !int(v.capacity, 0, 100)) return BAD
  if (v.early_bird_until !== null && !int(v.early_bird_until, 0)) return BAD
  if (!int(v.early_bird_pct, 0, 100)) return BAD
  return ok(v)
}

export function ticketTypePatch(b) {
  if (!isObj(b) || !int(b.price_cents, 0)) return BAD
  return ok({ price_cents: b.price_cents })
}

export function hold(b) {
  if (!isObj(b) || !str(b.ticket_type_id, 1, 64)) return BAD
  const seats = b.seat_nos
  if (!Array.isArray(seats) || seats.length === 0 || seats.length > 100) return BAD
  if (!seats.every((s) => typeof s === 'string' && SEAT.test(s))) return BAD
  if (new Set(seats).size !== seats.length) return BAD
  return ok({ ticket_type_id: b.ticket_type_id, seat_nos: [...seats] })
}

export function promoCode(code) {
  if (!str(code, 1, 32)) return BAD
  return ok(code.toUpperCase())
}

function pick(b, keys) {
  return Object.fromEntries(keys.filter((k) => b[k] !== undefined).map((k) => [k, b[k]]))
}
