// 訂單讀取與取消(T040 / T050)。
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync } from 'node:fs'
import { world, T0, DAY } from '../helpers/world.js'
import { userWith, bearer, jsonReq } from '../helpers/auth.js'
import { verifyQrPayload } from '../../src/lib/hmac.js'

let w, staff, alice, bob, ev, tt
const buy = async (who, seats) => {
  const h = await (await w.call(`/events/${ev.id}/holds`, jsonReq('POST', { ticket_type_id: tt.id, seat_nos: seats }, who.access))).json()
  return (await w.call(`/holds/${h.id}/confirm`, jsonReq('POST', {}, who.access))).json()
}
const cancel = (o, who = alice) => w.call(`/orders/${o.id}/cancel`, jsonReq('POST', {}, who.access))

describe.skipIf(!existsSync('schema.sql') || !existsSync('src/lib/db/holds.js'))('訂單', () => {
  beforeEach(async () => {
    w = await world()
    staff = await userWith(w.app, w.env, w.db, 's@example.com', { staff: true })
    alice = await userWith(w.app, w.env, w.db, 'a@example.com')
    bob = await userWith(w.app, w.env, w.db, 'b@example.com')
    ev = await (await w.call('/events', jsonReq('POST', { name: '音樂會', opens_at: T0 - DAY, deadline_at: T0 + DAY }, staff.access))).json()
    tt = await (await w.call(`/events/${ev.id}/ticket-types`, jsonReq('POST', { name: '一般', price_cents: 100000, capacity: 60 }, staff.access))).json()
  })
  afterEach(() => w.dispose())

  it('GET /orders 只回本人的', async () => {
    await buy(alice, ['A1']); await buy(bob, ['B1'])
    const list = (await (await w.call('/orders', bearer(alice.access))).json()).orders
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ event_name: '音樂會', items: [{ seat_no: 'A1', ticket_type_name: '一般', unit_price_cents: 100000 }] })
  })

  it('GET /orders/:id:本人 200、主辦 200、其他成員 404', async () => {
    const o = await buy(alice, ['A1'])
    expect((await w.call(`/orders/${o.id}`, bearer(alice.access))).status).toBe(200)
    expect((await w.call(`/orders/${o.id}`, bearer(staff.access))).status).toBe(200)
    expect((await w.call(`/orders/${o.id}`, bearer(bob.access))).status).toBe(404)
  })

  it('qr_payload 用同一把 key 驗得過,而且不含個資', async () => {
    const o = await buy(alice, ['A1'])
    expect(await verifyQrPayload(o.qr_payload, w.env.QR_SECRET)).toBe(true)
    expect(o.qr_payload).not.toContain('a@example.com')
  })

  it('取消 → 200、status cancelled、金額不變;座位釋放、名額還回去(H4)', async () => {
    const o = await buy(alice, ['A1'])
    const res = await cancel(o)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ status: 'cancelled', total_cents: o.total_cents })
    expect((await w.db.prepare('SELECT remaining FROM ticket_types WHERE id = ?').bind(tt.id).first()).remaining).toBe(60)
    const again = await w.call(`/events/${ev.id}/holds`, jsonReq('POST', { ticket_type_id: tt.id, seat_nos: ['A1'] }, bob.access))
    expect(again.status).toBe(201)
  })

  it('再取消一次 → 409 terminal_state;checked_in 不可取消 → 409', async () => {
    const o = await buy(alice, ['A1'])
    await cancel(o)
    expect((await cancel(o)).status).toBe(409)
    const o2 = await buy(alice, ['A2'])
    await w.db.prepare("UPDATE orders SET status = 'checked_in' WHERE id = ?").bind(o2.id).run()
    const res = await cancel(o2)
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('terminal_state')
  })

  it('別人的訂單取消 → 404', async () => {
    const o = await buy(alice, ['A1'])
    expect((await cancel(o, bob)).status).toBe(404)
  })
})
