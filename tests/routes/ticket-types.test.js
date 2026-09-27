// US2:票種。同活動名額總和 ≤ 100(規格層決定 9),檢查在 SQL 裡。
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync } from 'node:fs'
import { world, T0, DAY } from '../helpers/world.js'
import { userWith, jsonReq } from '../helpers/auth.js'

let w, staff, other, ev
const addType = (body, token = staff.access) => w.call(`/events/${ev.id}/ticket-types`, jsonReq('POST', body, token))

describe.skipIf(!existsSync('schema.sql'))('票種', () => {
  beforeEach(async () => {
    w = await world()
    staff = await userWith(w.app, w.env, w.db, 's@example.com', { staff: true })
    other = await userWith(w.app, w.env, w.db, 's2@example.com', { staff: true })
    ev = await (await w.call('/events', jsonReq('POST', { name: 'x', opens_at: T0 - DAY, deadline_at: T0 + DAY }, staff.access))).json()
  })
  afterEach(() => w.dispose())

  it('主辦建票種 → 201,remaining = capacity,早鳥預設沒有', async () => {
    const res = await addType({ name: '一般', price_cents: 100000, capacity: 60 })
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ name: '一般', price_cents: 100000, capacity: 60, remaining: 60, early_bird_until: null, early_bird_pct: 0 })
  })

  it('非主辦 → 403', async () => {
    expect((await addType({ name: '一般', price_cents: 1, capacity: 1 }, other.access)).status).toBe(403)
  })

  it('名額總和剛好 100 可以,再多 1 → 409 capacity_exceeded', async () => {
    expect((await addType({ name: 'A', price_cents: 1, capacity: 60 })).status).toBe(201)
    expect((await addType({ name: 'B', price_cents: 1, capacity: 40 })).status).toBe(201)
    const res = await addType({ name: 'C', price_cents: 1, capacity: 1 })
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('capacity_exceeded')
  })

  it('early_bird_pct 101 → 400', async () => {
    expect((await addType({ name: 'A', price_cents: 1, capacity: 1, early_bird_pct: 101 })).status).toBe(400)
  })

  it('主辦改價 → 200;非主辦 → 403;不存在 → 404', async () => {
    const tt = await (await addType({ name: 'A', price_cents: 100, capacity: 1 })).json()
    const res = await w.call(`/ticket-types/${tt.id}`, jsonReq('PATCH', { price_cents: 90 }, staff.access))
    expect(res.status).toBe(200)
    expect((await res.json()).price_cents).toBe(90)
    expect((await w.call(`/ticket-types/${tt.id}`, jsonReq('PATCH', { price_cents: 80 }, other.access))).status).toBe(403)
    expect((await w.call('/ticket-types/nope', jsonReq('PATCH', { price_cents: 80 }, staff.access))).status).toBe(404)
  })
})
