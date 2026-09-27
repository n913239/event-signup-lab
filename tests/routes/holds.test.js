// US1:保留與確認的規則(T023)。兩個真相來源(status 與 opens_at / deadline_at)各自一條測試。
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync } from 'node:fs'
import { world, T0, MIN, DAY } from '../helpers/world.js'
import { userWith, login, bearer, jsonReq } from '../helpers/auth.js'

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
    alice = await login(w.app, w.env, { email: 'a@example.com' })   // 推了一天,token 早過期,重新登入
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

  const remaining = async () => (await w.db.prepare('SELECT remaining FROM ticket_types WHERE id = ?').bind(tt.id).first()).remaining
  const confirm = (h, who = alice, body = {}) => w.call(`/holds/${h.id}/confirm`, jsonReq('POST', body, who.access))

  it('H1 一次保留 11 席 → 400', async () => {
    const seats = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'B1']
    expect((await hold(alice, seats)).status).toBe(400)
  })

  it('建 hold 時扣名額;放棄時還回去(H4)', async () => {
    const h = await (await hold(alice, ['A1', 'A2'])).json()
    expect(await remaining()).toBe(58)
    await w.call(`/holds/${h.id}`, bearer(alice.access, { method: 'DELETE' }))
    expect(await remaining()).toBe(60)
  })

  it('過期的 hold 被翻掉時名額還回去(H4)', async () => {
    const h = await (await hold(alice, ['A1'])).json()
    w.clock.set(h.expires_at)
    await hold(bob, ['B1'])                       // 搶位那一批第一句會翻掉過期的
    expect(await remaining()).toBe(59)            // 60 − alice 1(已還)− bob 1
  })

  it('確認 → 201 訂單:金額用確認當下的票價、QR 有值', async () => {
    const h = await (await hold(alice, ['A1', 'A2'])).json()
    const res = await confirm(h)
    expect(res.status).toBe(201)
    const o = await res.json()
    expect(o).toMatchObject({ status: 'confirmed', subtotal_cents: 200000, total_cents: 200000 })
    expect(o.items.map((i) => i.seat_no)).toEqual(['A1', 'A2'])
    expect(o.qr_payload).toMatch(new RegExp(`^${o.id}\\.`))
  })

  it('H7 同一個保留確認兩次 → 第二次 200、同一張訂單', async () => {
    const h = await (await hold(alice, ['A1'])).json()
    const first = await (await confirm(h)).json()
    const again = await confirm(h)
    expect(again.status).toBe(200)
    expect((await again.json()).id).toBe(first.id)
    expect((await w.db.prepare('SELECT COUNT(*) AS n FROM orders').first()).n).toBe(1)
  })

  it('M1 早鳥看建立保留的時間:保留時在早鳥期、確認時已過 → 仍有早鳥', async () => {
    const eb = await (await w.call(`/events/${ev.id}/ticket-types`, jsonReq('POST',
      { name: '早鳥', price_cents: 100000, capacity: 10, early_bird_until: T0 + MIN, early_bird_pct: 20 }, staff.access))).json()
    const h = await (await w.call(`/events/${ev.id}/holds`, jsonReq('POST', { ticket_type_id: eb.id, seat_nos: ['C1'] }, alice.access))).json()
    w.clock.set(T0 + 3 * MIN)                     // 早鳥已過,保留還沒到期(7 分鐘)
    const o = await (await confirm(h)).json()
    expect(o).toMatchObject({ early_bird_pct: 20, total_cents: 80000 })
  })

  it('確認時的票價取當下(改價後未確認的 hold 以新價計);已確認的訂單不變', async () => {
    const h1 = await (await hold(alice, ['A1'])).json()
    const o1 = await (await confirm(h1)).json()
    const h2 = await (await hold(bob, ['A2'])).json()
    await w.call(`/ticket-types/${tt.id}`, jsonReq('PATCH', { price_cents: 50000 }, staff.access))
    const o2 = await (await confirm(h2, bob)).json()
    expect(o2.total_cents).toBe(50000)
    const again = await (await w.call(`/orders/${o1.id}`, bearer(alice.access))).json()
    expect(again.total_cents).toBe(100000)
  })
})

describe.skipIf(!existsSync('schema.sql') || !existsSync('src/lib/db/holds.js'))('優惠碼', () => {
  const addPromo = (code, discount, validUntil, eventId = null) => w.db.prepare(
    'INSERT INTO promo_codes (code, discount_cents, valid_until, event_id) VALUES (?, ?, ?, ?)').bind(code, discount, validUntil, eventId).run()
  const confirm = (h, who, body) => w.call(`/holds/${h.id}/confirm`, jsonReq('POST', body, who.access))

  beforeEach(async () => {
    w = await world()
    staff = await userWith(w.app, w.env, w.db, 's@example.com', { staff: true })
    alice = await userWith(w.app, w.env, w.db, 'a@example.com')
    ev = await (await w.call('/events', jsonReq('POST', { name: 'x', opens_at: T0 - DAY, deadline_at: T0 + DAY, group_min_qty: 4, group_pct: 30 }, staff.access))).json()
    tt = await (await w.call(`/events/${ev.id}/ticket-types`, jsonReq('POST', { name: '一般', price_cents: 100000, capacity: 60 }, staff.access))).json()
    await addPromo('WELCOME', 10000, T0 + DAY)
    await addPromo('OLD', 10000, T0 - 1)
  })
  afterEach(() => w.dispose())

  it('套用 → 訂單記 promo_code 與實際折抵;大小寫不敏感', async () => {
    const h = await (await hold(alice, ['A1'])).json()
    const o = await (await confirm(h, alice, { promo_code: 'welcome' })).json()
    expect(o).toMatchObject({ promo_code: 'WELCOME', promo_cents: 10000, total_cents: 90000 })
  })

  it('M4 過期的碼 → 409 promo_rejected;不存在的碼 → 409', async () => {
    const h = await (await hold(alice, ['A1'])).json()
    let res = await confirm(h, alice, { promo_code: 'OLD' })
    expect(res.status).toBe(409)
    expect(await errorOf(res)).toBe('promo_rejected')
    res = await confirm(h, alice, { promo_code: 'NOPE' })
    expect(res.status).toBe(409)
  })

  it('每人每活動一次:第二張訂單再用 → 409;M2 取消後可以再用', async () => {
    const h1 = await (await hold(alice, ['A1'])).json()
    const o1 = await (await confirm(h1, alice, { promo_code: 'WELCOME' })).json()
    const h2 = await (await hold(alice, ['A2'])).json()
    expect((await confirm(h2, alice, { promo_code: 'WELCOME' })).status).toBe(409)
    await w.call(`/orders/${o1.id}/cancel`, jsonReq('POST', {}, alice.access))
    expect((await confirm(h2, alice, { promo_code: 'WELCOME' })).status).toBe(201)
  })

  it('C8 改定:碼已用過,但團體折扣本來就比較好 → 忽略碼、照樣成立', async () => {
    const h1 = await (await hold(alice, ['A1'])).json()
    await confirm(h1, alice, { promo_code: 'WELCOME' })                       // 用掉 WELCOME
    const h2 = await (await hold(alice, ['B1', 'B2', 'B3', 'B4'])).json()     // 團體 30% > 100 元
    const res = await confirm(h2, alice, { promo_code: 'WELCOME' })
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ promo_code: null, group_pct: 30 })
  })

  it('C8 改定:碼已用過,早鳥跟碼一樣好(都折 100 元)→ 忽略碼,套早鳥', async () => {
    const eb = await (await w.call(`/events/${ev.id}/ticket-types`, jsonReq('POST',
      { name: '早鳥票', price_cents: 100000, capacity: 5, early_bird_until: T0 + DAY, early_bird_pct: 10 }, staff.access))).json()
    const h1 = await (await hold(alice, ['A1'])).json()
    await confirm(h1, alice, { promo_code: 'WELCOME' })
    const h2 = await (await w.call(`/events/${ev.id}/holds`, jsonReq('POST', { ticket_type_id: eb.id, seat_nos: ['D1'] }, alice.access))).json()
    const res = await confirm(h2, alice, { promo_code: 'WELCOME' })
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ promo_code: null, early_bird_pct: 10, total_cents: 90000 })
  })

  it('C8 改定:碼不存在,但有別的折扣 → 忽略碼;沒有別的折扣 → 409', async () => {
    const h = await (await hold(alice, ['A1', 'A2', 'A3', 'A4'])).json()
    expect((await confirm(h, alice, { promo_code: 'TYPO' })).status).toBe(201)
    const h2 = await (await hold(alice, ['C1'])).json()
    expect((await confirm(h2, alice, { promo_code: 'TYPO' })).status).toBe(409)
  })

  it('碼沒被選中(團體 30% 更優惠)→ 訂單不記碼,碼沒有用掉', async () => {
    const h = await (await hold(alice, ['A1', 'A2', 'A3', 'A4'])).json()
    const o = await (await confirm(h, alice, { promo_code: 'WELCOME' })).json()
    expect(o).toMatchObject({ promo_code: null, promo_cents: 0, group_pct: 30, total_cents: 280000 })
    const h2 = await (await hold(alice, ['B1'])).json()
    expect((await confirm(h2, alice, { promo_code: 'WELCOME' })).status).toBe(201)
  })
})

