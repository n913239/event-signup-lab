// 併發(T022)。閘門讓所有請求到齊才一起放行(tests/helpers/gate.js)。
// SC-004 三方競態:哪一方贏是 T030(作者手寫 holds.js)的決定;這裡只釘住「每次都一樣」與「座位不會同時屬於兩個人」。
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync } from 'node:fs'
import { world, T0, DAY } from './helpers/world.js'
import { userWith, jsonReq } from './helpers/auth.js'
import { runConcurrently } from './helpers/gate.js'

const has = existsSync('schema.sql') && existsSync('src/lib/db/holds.js')

async function setup({ capacity = 60, members = 8 } = {}) {
  const w = await world()
  const staff = await userWith(w.app, w.env, w.db, 's@example.com', { staff: true })
  const ev = await (await w.call('/events', jsonReq('POST', { name: 'x', opens_at: T0 - DAY, deadline_at: T0 + DAY }, staff.access))).json()
  const tt = await (await w.call(`/events/${ev.id}/ticket-types`, jsonReq('POST', { name: '一般', price_cents: 100, capacity }, staff.access))).json()
  const users = []
  for (let i = 0; i < members; i++) users.push(await userWith(w.app, w.env, w.db, `u${i}@example.com`))
  const hold = (u, seats) => w.call(`/events/${ev.id}/holds`, jsonReq('POST', { ticket_type_id: tt.id, seat_nos: seats }, u.access))
  return { w, ev, tt, users, hold }
}
const seatsTaken = async (w, evId) => (await w.db.prepare(
  "SELECT seat_no, member_id, status FROM seat_holds WHERE event_id = ? AND status IN ('holding','confirmed') ORDER BY seat_no").bind(evId).all()).results

describe.skipIf(!has)('併發', () => {
  let s
  afterEach(() => s?.w.dispose())

  it('SC-001 名額 3、8 人各搶不同座位並確認 → 恰好 3 張訂單', async () => {
    s = await setup({ capacity: 3 })
    const rows = 'ABCDEFGH'
    const { ok } = await runConcurrently(8, async (i) => {
      const r = await s.hold(s.users[i], [`${rows[i]}1`])
      if (r.status !== 201) return r.status
      const h = await r.json()
      return (await s.w.call(`/holds/${h.id}/confirm`, jsonReq('POST', {}, s.users[i].access))).status
    })
    expect(ok).toHaveLength(8)
    expect(ok.filter((x) => x === 201)).toHaveLength(3)
    expect((await s.w.db.prepare("SELECT COUNT(*) AS n FROM orders WHERE event_id = ? AND status = 'confirmed'").bind(s.ev.id).first()).n).toBe(3)
  })

  it('SC-002 8 人搶同一個座位 → 恰一個 201,其餘 409 seat_taken', async () => {
    s = await setup()
    const { ok } = await runConcurrently(8, async (i) => {
      const r = await s.hold(s.users[i], ['A1'])
      return [r.status, (await r.json()).error]
    })
    expect(ok.filter(([st]) => st === 201)).toHaveLength(1)
    expect(ok.filter(([st, e]) => st === 409 && e === 'seat_taken')).toHaveLength(7)
  })

  it('多座全有全無:A2 已被佔 → 409,A1 沒有被留下', async () => {
    s = await setup()
    await s.hold(s.users[0], ['A2'])
    const r = await s.hold(s.users[1], ['A1', 'A2'])
    expect(r.status).toBe(409)
    expect((await seatsTaken(s.w, s.ev.id)).map((x) => x.seat_no)).toEqual(['A2'])
  })

  it('票種名額不足 → 409 sold_out,座位沒有被留下', async () => {
    s = await setup({ capacity: 1 })
    const r = await s.hold(s.users[0], ['A1', 'A2'])
    expect(r.status).toBe(409)
    expect((await r.json()).error).toBe('sold_out')
    expect(await seatsTaken(s.w, s.ev.id)).toEqual([])
  })

  it('座位衝突與名額不足同時發生 → seat_taken(作者定:先檢查座位)', async () => {
    s = await setup({ capacity: 2 })
    await s.hold(s.users[0], ['A1'])                  // 剩 1 名額,A1 已被佔
    const r = await s.hold(s.users[1], ['A1', 'A2'])  // 座位衝突 + 名額不足
    expect(r.status).toBe(409)
    expect((await r.json()).error).toBe('seat_taken')
  })

  it('SC-004 三方競態(到期那一刻:原持有人確認 / 別人搶同座 / sweep),重跑 5 次結果一樣,座位不會同時屬於兩個人', async () => {
    const { sweepExpired } = await import('../src/lib/db/holds.js')
    const outcomes = []
    for (let run = 0; run < 5; run++) {
      s = await setup({ members: 2 })
      const [owner, rival] = s.users
      const h = await (await s.hold(owner, ['A1'])).json()
      s.w.clock.set(h.expires_at)
      const { ok } = await runConcurrently(3, async (i) => {
        if (i === 0) return (await s.w.call(`/holds/${h.id}/confirm`, jsonReq('POST', {}, owner.access))).status
        if (i === 1) return (await s.hold(rival, ['A1'])).status
        return `sweep:${await sweepExpired(s.w.db, h.expires_at)}`
      })
      const taken = await seatsTaken(s.w, s.ev.id)
      expect(taken.length).toBeLessThanOrEqual(1)
      outcomes.push(JSON.stringify({ ok, owner: taken[0]?.member_id === owner.member.id }))
      await s.w.dispose(); s = null
    }
    expect(new Set(outcomes).size).toBe(1)
  })
})
