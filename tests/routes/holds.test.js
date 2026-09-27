// US1:保留與確認的規則(T023)。兩個真相來源(status 與 opens_at / deadline_at)各自一條測試。
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync } from 'node:fs'
import { world, T0, MIN, DAY } from '../helpers/world.js'
import { userWith, bearer, jsonReq } from '../helpers/auth.js'

let w, staff, alice, bob, ev, tt
const hold = (who, seats, eventId = ev.id) =>
  w.call(`/events/${eventId}/holds`, jsonReq('POST', { ticket_type_id: tt.id, seat_nos: seats }, who.access))
const errorOf = async (res) => (await res.json()).error

describe.skipIf(!existsSync('schema.sql') || !existsSync('src/lib/db/holds.js'))('保留與確認', () => {
  beforeEach(async () => {
    w = await world()
    staff = await userWith(w.app, w.env, w.db, 's@example.com', { staff: true })
    alice = await userWith(w.app, w.env, w.db, 'a@example.com')
    bob = await userWith(w.app, w.env, w.db, 'b@example.com')
    ev = await (await w.call('/events', jsonReq('POST', { name: 'x', opens_at: T0 - DAY, deadline_at: T0 + DAY, hold_ttl_minutes: 7 }, staff.access))).json()
    tt = await (await w.call(`/events/${ev.id}/ticket-types`, jsonReq('POST', { name: '一般', price_cents: 100000, capacity: 60 }, staff.access))).json()
  })
  afterEach(() => w.dispose())

  it('保留成功 → 201,expires_at = now + 活動設定的 ttl,帶 server_now', async () => {
    const res = await hold(alice, ['A1', 'A2'])
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ seat_nos: ['A1', 'A2'], status: 'holding', expires_at: T0 + 7 * MIN, server_now: T0 })
  })

  it('closed 的活動 → 409 not_on_sale', async () => {
    await w.call(`/events/${ev.id}/close`, bearer(staff.access, { method: 'POST' }))
    const res = await hold(alice, ['A1'])
    expect(res.status).toBe(409)
    expect(await errorOf(res)).toBe('not_on_sale')
  })

  it('status 仍是 on_sale,但時間過了 deadline_at → 409', async () => {
    w.clock.set(T0 + DAY)
    expect((await hold(alice, ['A1'])).status).toBe(409)
  })

  it('還沒到 opens_at → 409', async () => {
    w.clock.set(T0 - DAY - 1)
    expect((await hold(alice, ['A1'])).status).toBe(409)
  })

  it('同一人同一活動已有有效 hold → 409 hold_exists', async () => {
    await hold(alice, ['A1'])
    const res = await hold(alice, ['B1'])
    expect(res.status).toBe(409)
    expect(await errorOf(res)).toBe('hold_exists')
  })

  it('別人的 hold:DELETE / confirm → 404', async () => {
    const h = await (await hold(alice, ['A1'])).json()
    expect((await w.call(`/holds/${h.id}`, bearer(bob.access, { method: 'DELETE' }))).status).toBe(404)
    expect((await w.call(`/holds/${h.id}/confirm`, jsonReq('POST', {}, bob.access))).status).toBe(404)
  })

  it('過期後 confirm → 409 hold_expired,而且座位可以被別人保留', async () => {
    const h = await (await hold(alice, ['A1'])).json()
    w.clock.set(h.expires_at)
    const res = await w.call(`/holds/${h.id}/confirm`, jsonReq('POST', {}, alice.access))
    expect(res.status).toBe(409)
    expect(await errorOf(res)).toBe('hold_expired')
    expect((await hold(bob, ['A1'])).status).toBe(201)
  })

  it('主動放棄 → 204,座位釋放', async () => {
    const h = await (await hold(alice, ['A1'])).json()
    expect((await w.call(`/holds/${h.id}`, bearer(alice.access, { method: 'DELETE' }))).status).toBe(204)
    expect((await hold(bob, ['A1'])).status).toBe(201)
  })

  it('提前截止後,截止前建立的 hold 在 expires_at 前仍可 confirm → 201', async () => {
    const h = await (await hold(alice, ['A1'])).json()
    await w.call(`/events/${ev.id}/close`, bearer(staff.access, { method: 'POST' }))
    expect((await w.call(`/holds/${h.id}/confirm`, jsonReq('POST', {}, alice.access))).status).toBe(201)
  })
})
