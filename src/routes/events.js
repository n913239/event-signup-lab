import { Hono } from 'hono'
import { notImplemented } from './_stub.js'
import { requireMember, requireStaff, requireOwner } from './_auth.js'
import * as validate from '../domain/validate.js'
import * as events from '../lib/db/events.js'
import * as ticketTypes from '../lib/db/ticket-types.js'
import * as present from '../presentation/events.js'

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
  try {
    await events.update(c.env.DB, e.id, e.owner_id, v.value)
  } catch (x) {
    if (/CHECK/.test(x.message)) return err(c, 400, 'invalid_input')   // opens_at >= deadline_at
    throw x
  }
  for (const t of v.value.ticket_types ?? []) {
    if (await ticketTypes.updateCapacity(c.env.DB, t.id, e.id, t.capacity) === 1) continue
    const row = await ticketTypes.findById(c.env.DB, t.id)
    if (!row || row.event_id !== e.id) return err(c, 404, 'not_found')
    return err(c, 409, t.capacity < row.capacity - row.remaining ? 'capacity_below_sold' : 'capacity_exceeded')
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

events_.post('/:id/holds', notImplemented)   // 選位 + 保留,seat_nos 全有全無(T033)
