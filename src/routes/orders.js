import { Hono } from 'hono'
import { requireMember } from './_auth.js'
import * as orders from '../lib/db/orders.js'
import * as present from '../presentation/orders.js'

export const orders_ = new Hono()
export { orders_ as orders }

orders_.use('*', requireMember)

const err = (c, status, error) => c.json({ error, server_now: c.get('now') }, status)

orders_.get('/', async (c) => {                                  // 我的票券
  const list = await orders.listByMember(c.env.DB, c.get('member').id)
  return c.json({ orders: await Promise.all(list.map((o) => present.order(o, c.env.QR_SECRET))), server_now: c.get('now') })
})

orders_.get('/:id', async (c) => {                               // 本人或主辦;其他人一律 404
  const me = c.get('member').id
  const o = await orders.findById(c.env.DB, c.req.param('id'))
  if (!o || (o.member_id !== me && o.owner_id !== me)) return err(c, 404, 'not_found')
  return c.json(await present.order(o, c.env.QR_SECRET))
})

orders_.post('/:id/cancel', async (c) => {                       // 僅本人;checked_in / cancelled → 409
  const me = c.get('member').id
  const o = await orders.findById(c.env.DB, c.req.param('id'))
  if (!o || o.member_id !== me) return err(c, 404, 'not_found')
  if (await orders.cancel(c.env.DB, o.id, me) === 0) return err(c, 409, 'terminal_state')
  return c.json(await present.order(await orders.findById(c.env.DB, o.id), c.env.QR_SECRET))
})
