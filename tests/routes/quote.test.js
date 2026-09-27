// POST /holds/:id/quote:試算,不建訂單(2026-09-27 作者要求:套用按鈕當場顯示原價、折扣、應付)。
// 跟 confirm 共用同一套算法:試算說 applied,確認就一定照這個金額成立。
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync } from 'node:fs'
import { world, T0, DAY } from '../helpers/world.js'
import { userWith, jsonReq } from '../helpers/auth.js'

let w, staff, alice, bob, ev, general, vip
const hold = async (who, tt, seats) => (await w.call(`/events/${ev.id}/holds`, jsonReq('POST', { ticket_type_id: tt.id, seat_nos: seats }, who.access))).json()
const quote = (h, who, body = {}) => w.call(`/holds/${h.id}/quote`, jsonReq('POST', body, who.access))

describe.skipIf(!existsSync('schema.sql'))('試算', () => {
  beforeEach(async () => {
    w = await world()
    staff = await userWith(w.app, w.env, w.db, 's@example.com', { staff: true })
    alice = await userWith(w.app, w.env, w.db, 'a@example.com')
    bob = await userWith(w.app, w.env, w.db, 'b@example.com')
    ev = await (await w.call('/events', jsonReq('POST', { name: 'x', opens_at: T0 - DAY, deadline_at: T0 + DAY }, staff.access))).json()
    general = await (await w.call(`/events/${ev.id}/ticket-types`, jsonReq('POST', { name: '一般', price_cents: 100000, capacity: 50 }, staff.access))).json()
    vip = await (await w.call(`/events/${ev.id}/ticket-types`, jsonReq('POST', { name: 'VIP', price_cents: 200000, capacity: 50, early_bird_until: T0 + DAY, early_bird_pct: 10 }, staff.access))).json()
    await w.db.prepare("INSERT INTO promo_codes VALUES ('WELCOME', 10000, ?, NULL)").bind(T0 + DAY).run()
  })
  afterEach(() => w.dispose())

  it('沒帶碼 → 原價與目前最好的折扣', async () => {
    const h = await hold(alice, vip, ['A1'])
    expect(await (await quote(h, alice)).json()).toMatchObject({ subtotal_cents: 200000, applied: 'early_bird', total_cents: 180000, promo_status: 'none' })
  })

  it('碼有效而且最划算 → applied', async () => {
    const h = await hold(alice, general, ['A1'])
    expect(await (await quote(h, alice, { promo_code: 'welcome' })).json()).toMatchObject({ applied: 'promo', promo_cents: 10000, total_cents: 90000, promo_status: 'applied' })
  })

  it('碼有效但早鳥更划算 → not_better,金額照早鳥', async () => {
    const h = await hold(alice, vip, ['A1'])
    expect(await (await quote(h, alice, { promo_code: 'WELCOME' })).json()).toMatchObject({ applied: 'early_bird', total_cents: 180000, promo_status: 'not_better' })
  })

  it('碼無效 → invalid,金額照不帶碼', async () => {
    const h = await hold(alice, general, ['A1'])
    expect(await (await quote(h, alice, { promo_code: 'TYPO' })).json()).toMatchObject({ applied: null, total_cents: 100000, promo_status: 'invalid' })
  })

  it('試算不建訂單、不用掉碼', async () => {
    const h = await hold(alice, general, ['A1'])
    await quote(h, alice, { promo_code: 'WELCOME' })
    expect((await w.db.prepare('SELECT COUNT(*) AS n FROM orders').first()).n).toBe(0)
    const o = await (await w.call(`/holds/${h.id}/confirm`, jsonReq('POST', { promo_code: 'WELCOME' }, alice.access))).json()
    expect(o.total_cents).toBe(90000)
  })

  it('別人的 hold → 404;過期 → 409 hold_expired', async () => {
    const h = await hold(alice, general, ['A1'])
    expect((await quote(h, bob)).status).toBe(404)
    w.clock.set(h.expires_at)
    alice = await (await import('../helpers/auth.js')).login(w.app, w.env, { email: 'a@example.com' })
    expect((await quote(h, alice)).status).toBe(409)
  })
})
