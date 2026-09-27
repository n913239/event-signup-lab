import { Hono } from 'hono'
import { requireMember, ownerCheck } from './_auth.js'
import * as validate from '../domain/validate.js'
import * as ticketTypes from '../lib/db/ticket-types.js'
import * as events from '../lib/db/events.js'

export const ticketTypes_ = new Hono()
export { ticketTypes_ as ticketTypes }

ticketTypes_.use('*', requireMember)

// 改票價。這條是價格快照的觸發器 —— 改完之後歷史訂單的金額不能跟著變(訂單存的是快照)。
ticketTypes_.patch('/:id', async (c) => {
  const t = await ticketTypes.findById(c.env.DB, c.req.param('id'))
  if (!t) return c.json({ error: 'not_found', server_now: c.get('now') }, 404)
  const denied = ownerCheck(c, await events.findById(c.env.DB, t.event_id, c.get('now')))
  if (denied) return denied
  let v
  try { v = validate.ticketTypePatch(await c.req.json()) } catch { v = { ok: false, error: 'invalid_input' } }
  if (!v.ok) return c.json({ error: v.error, server_now: c.get('now') }, 400)
  await ticketTypes.updatePrice(c.env.DB, t.id, v.value.price_cents)
  return c.json(await ticketTypes.findById(c.env.DB, t.id))
})
