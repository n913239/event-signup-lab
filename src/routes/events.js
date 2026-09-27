import { Hono } from 'hono'
import { requireMember, requireStaff, requireOwner } from './_auth.js'
import * as validate from '../domain/validate.js'
import * as events from '../lib/db/events.js'
import * as ticketTypes from '../lib/db/ticket-types.js'
import * as present from '../presentation/events.js'
import { canHold } from '../domain/time-rules.js'
import * as holds from '../lib/db/holds.js'

export const events_ = new Hono()
export { events_ as events }

events_.use('*', requireMember)   // 全部要登入;主辦權限用 requireOwner

const err = (c, status, error) => c.json({ error, server_now: c.get('now') }, status)
const body = async (c) => { try { return await c.req.json() } catch { return null } }

events_.post('/', requireStaff, async (c) => {       // staff 建活動,直接是 on_sale
  const v = validate.eventCreate(await body(c))
  if (!v.ok) return err(c, 400, v.error)
  const e = await events.create(c.env.DB, c.get('member').id, v.value, c.get('now'))
  return c.json(present.event(e), 201)
})

events_.get('/', async (c) => {                     // 列表,可 ?status=on_sale;draft 只給主辦
  const status = c.req.query('status')
  if (status && !['draft', 'on_sale', 'closed', 'finished'].includes(status)) return err(c, 400, 'invalid_input')
  const list = await events.list(c.env.DB, { status, viewerId: c.get('member').id }, c.get('now'))
  return c.json({ events: list.map(present.summary), server_now: c.get('now') })
})

events_.get('/:id', async (c) => {                  // 含票種、剩餘名額、座位狀態、我的 hold
  const now = c.get('now')
  const me = c.get('member').id
  const e = await events.findById(c.env.DB, c.req.param('id'), now)
  if (!e || (e.status === 'draft' && e.owner_id !== me)) return err(c, 404, 'not_found')
  const [tts, seats, myHold] = await Promise.all([
    ticketTypes.listByEvent(c.env.DB, e.id),
    events.seatMap(c.env.DB, e.id, me, now),
    events.findActiveHold(c.env.DB, e.id, me, now),
  ])
  return c.json(present.detail(e, { ticketTypes: tts, seats, myHold: myHold && { ...myHold, server_now: now }, now }))
})

events_.patch('/:id', requireOwner, async (c) => {  // 僅主辦:改時間 / 參數 / 名額
  const v = validate.eventPatch(await body(c))
  if (!v.ok) return err(c, 400, v.error)
  const e = c.get('event')
  // 先驗名額:每個票種都屬於這個活動、不小於已售、改完總和 ≤ 100;不合法就一筆都不寫(T081 全有全無)
  const caps = v.value.ticket_types ?? []
  if (caps.length) {
    const current = new Map((await ticketTypes.listByEvent(c.env.DB, e.id)).map((x) => [x.id, x]))
    let total = [...current.values()].reduce((s, x) => s + x.capacity, 0)
    for (const { id, capacity } of caps) {
      const row = current.get(id)
      if (!row) return err(c, 404, 'not_found')
      if (capacity < row.capacity - row.remaining) return err(c, 409, 'capacity_below_sold')
      total += capacity - row.capacity
    }
    if (total > 100) return err(c, 409, 'capacity_exceeded')
  }
  try {
    if (!(await events.updateWithCapacities(c.env.DB, e.id, e.owner_id, v.value, caps))) return err(c, 409, 'capacity_below_sold')
  } catch (x) {
    if (/capacity_exceeded/.test(x.message)) return err(c, 409, 'capacity_exceeded')   // schema 的 trigger(T082)
    if (/CHECK/.test(x.message)) return err(c, /remaining/.test(x.message) ? 409 : 400, /remaining/.test(x.message) ? 'capacity_below_sold' : 'invalid_input')
    throw x
  }
  return c.json(present.event(await events.findById(c.env.DB, e.id, c.get('now'))))
})

events_.post('/:id/close', requireOwner, async (c) => {   // 僅主辦:手動提前截止,只擋新 hold
  const e = c.get('event')
  if (await events.close(c.env.DB, e.id, e.owner_id) !== 1) return err(c, 409, 'terminal_state')
  return c.json(present.event(await events.findById(c.env.DB, e.id, c.get('now'))))
})

events_.post('/:id/ticket-types', requireOwner, async (c) => {   // 僅主辦:建票種,名額總和 ≤ 100
  const v = validate.ticketTypeCreate(await body(c))
  if (!v.ok) return err(c, 400, v.error)
  const t = await ticketTypes.create(c.env.DB, c.get('event').id, v.value)
  if (!t) return err(c, 409, 'capacity_exceeded')
  return c.json(t, 201)
})

// 選位 + 保留:seat_nos 全有全無;名額在這一刻扣(作者定)
events_.post('/:id/holds', async (c) => {
  const v = validate.hold(await body(c))
  if (!v.ok) return err(c, 400, v.error)
  const now = c.get('now')
  const me = c.get('member').id
  const e = await events.findById(c.env.DB, c.req.param('id'), now)
  if (!e || (e.status === 'draft' && e.owner_id !== me)) return err(c, 404, 'not_found')
  if (!canHold(e, now).ok) return err(c, 409, 'not_on_sale')   // status 與時間兩個真相來源,契約只有一個代碼
  const tt = await ticketTypes.findById(c.env.DB, v.value.ticket_type_id)
  if (!tt || tt.event_id !== e.id) return err(c, 404, 'not_found')
  const r = await holds.createHold(c.env.DB, {
    eventId: e.id, memberId: me, ticketTypeId: tt.id, seatNos: v.value.seat_nos, ttlMinutes: e.hold_ttl_minutes,
  }, now)
  if (r.error) return err(c, 409, r.error)
  return c.json({ ...r.hold, server_now: now }, 201)
})
