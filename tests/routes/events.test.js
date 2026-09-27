// US2:活動。主辦 = 建立該活動的 staff(規格層決定 8)。
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync } from 'node:fs'
import { world, T0, DAY } from '../helpers/world.js'
import { userWith, bearer, jsonReq } from '../helpers/auth.js'

let w, staff, other, member
const newEvent = (over = {}) => ({ name: '演唱會', opens_at: T0 - DAY, deadline_at: T0 + 30 * DAY, ...over })
const create = (token, over) => w.call('/events', jsonReq('POST', newEvent(over), token))

describe.skipIf(!existsSync('schema.sql'))('活動', () => {
  beforeEach(async () => {
    w = await world()
    staff = await userWith(w.app, w.env, w.db, 's@example.com', { staff: true })
    other = await userWith(w.app, w.env, w.db, 's2@example.com', { staff: true })
    member = await userWith(w.app, w.env, w.db, 'm@example.com')
  })
  afterEach(() => w.dispose())

  it('member 建活動 → 403', async () => {
    expect((await create(member.access)).status).toBe(403)
  })

  it('staff 建活動 → 201,直接 on_sale、owner 是自己、ttl 預設 10、團體預設 4 / 10', async () => {
    const res = await create(staff.access)
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ status: 'on_sale', owner_id: staff.member.id, hold_ttl_minutes: 10, group_min_qty: 4, group_pct: 10, remaining_seats: 100 })
  })

  it('hold_ttl_minutes 4 / 31 → 400', async () => {
    expect((await create(staff.access, { hold_ttl_minutes: 4 })).status).toBe(400)
    expect((await create(staff.access, { hold_ttl_minutes: 31 })).status).toBe(400)
  })

  it('另一個 staff 改 / 截止別人的活動 → 403;活動不存在 → 404', async () => {
    const ev = await (await create(staff.access)).json()
    expect((await w.call(`/events/${ev.id}`, jsonReq('PATCH', { name: 'x' }, other.access))).status).toBe(403)
    expect((await w.call(`/events/${ev.id}/close`, bearer(other.access, { method: 'POST' }))).status).toBe(403)
    expect((await w.call('/events/nope/close', bearer(staff.access, { method: 'POST' }))).status).toBe(404)
  })

  it('列表預設不含 draft;主辦看得到自己的 draft;?status=on_sale 篩選', async () => {
    const a = await (await create(staff.access)).json()
    const b = await (await create(staff.access, { name: '草稿' })).json()
    await w.db.prepare("UPDATE events SET status = 'draft' WHERE id = ?").bind(b.id).run()
    const ids = async (token, q = '') => (await (await w.call(`/events${q}`, bearer(token))).json()).events.map((e) => e.id)
    expect(await ids(member.access)).toEqual([a.id])
    expect((await ids(staff.access)).sort()).toEqual([a.id, b.id].sort())
    expect(await ids(staff.access, '?status=on_sale')).toEqual([a.id])
  })

  it('member 看不到 draft 的明細(404)', async () => {
    const b = await (await create(staff.access)).json()
    await w.db.prepare("UPDATE events SET status = 'draft' WHERE id = ?").bind(b.id).run()
    expect((await w.call(`/events/${b.id}`, bearer(member.access))).status).toBe(404)
  })

  it('明細有 100 個座位、票種、my_hold、server_now', async () => {
    const ev = await (await create(staff.access)).json()
    await w.call(`/events/${ev.id}/ticket-types`, jsonReq('POST', { name: '一般', price_cents: 100000, capacity: 60 }, staff.access))
    const d = await (await w.call(`/events/${ev.id}`, bearer(member.access))).json()
    expect(d.seats).toHaveLength(100)
    expect(d.seats.every((s) => s.state === 'free')).toBe(true)
    expect(d.seats[0].seat_no).toBe('A1')
    expect(d.seats[99].seat_no).toBe('J10')
    expect(d.ticket_types).toHaveLength(1)
    expect(d.my_hold).toBeNull()
    expect(d.server_now).toBe(T0)
  })

  it('主辦改時間與參數 → 200;開賣時間改到截止之後 → 400', async () => {
    const ev = await (await create(staff.access)).json()
    const res = await w.call(`/events/${ev.id}`, jsonReq('PATCH', { hold_ttl_minutes: 15, group_pct: 20 }, staff.access))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ hold_ttl_minutes: 15, group_pct: 20 })
    expect((await w.call(`/events/${ev.id}`, jsonReq('PATCH', { opens_at: T0 + 60 * DAY }, staff.access))).status).toBe(400)
  })

  it('改名額小於已售 → 409 capacity_below_sold', async () => {
    const ev = await (await create(staff.access)).json()
    const tt = await (await w.call(`/events/${ev.id}/ticket-types`, jsonReq('POST', { name: '一般', price_cents: 100, capacity: 10 }, staff.access))).json()
    await w.db.prepare('UPDATE ticket_types SET remaining = 7 WHERE id = ?').bind(tt.id).run()   // 已售 3
    const res = await w.call(`/events/${ev.id}`, jsonReq('PATCH', { ticket_types: [{ id: tt.id, capacity: 2 }] }, staff.access))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('capacity_below_sold')
    const ok = await w.call(`/events/${ev.id}`, jsonReq('PATCH', { ticket_types: [{ id: tt.id, capacity: 5 }] }, staff.access))
    expect(ok.status).toBe(200)
    const row = await w.db.prepare('SELECT capacity, remaining FROM ticket_types WHERE id = ?').bind(tt.id).first()
    expect(row).toEqual({ capacity: 5, remaining: 2 })
  })

  it('改名額全有全無:第二個票種低於已售 → 409,活動欄位與第一個票種都沒變(T081)', async () => {
    const ev = await (await create(staff.access)).json()
    const t1 = await (await w.call(`/events/${ev.id}/ticket-types`, jsonReq('POST', { name: 'A', price_cents: 1, capacity: 10 }, staff.access))).json()
    const t2 = await (await w.call(`/events/${ev.id}/ticket-types`, jsonReq('POST', { name: 'B', price_cents: 1, capacity: 10 }, staff.access))).json()
    await w.db.prepare('UPDATE ticket_types SET remaining = 5 WHERE id = ?').bind(t2.id).run()   // B 已售 5
    const res = await w.call(`/events/${ev.id}`, jsonReq('PATCH', { name: '改過', ticket_types: [{ id: t1.id, capacity: 20 }, { id: t2.id, capacity: 3 }] }, staff.access))
    expect(res.status).toBe(409)
    expect((await w.db.prepare('SELECT name FROM events WHERE id = ?').bind(ev.id).first()).name).toBe('演唱會')
    expect((await w.db.prepare('SELECT capacity FROM ticket_types WHERE id = ?').bind(t1.id).first()).capacity).toBe(10)
  })

  it('截止 → closed;再截止一次 → 409', async () => {
    const ev = await (await create(staff.access)).json()
    const res = await w.call(`/events/${ev.id}/close`, bearer(staff.access, { method: 'POST' }))
    expect(res.status).toBe(200)
    expect((await res.json()).status).toBe('closed')
    expect((await w.call(`/events/${ev.id}/close`, bearer(staff.access, { method: 'POST' }))).status).toBe(409)
  })
})
