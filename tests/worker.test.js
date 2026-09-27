// 排程清掃(T078):sweepExpired 把過期的 holding 翻成 expired、列留著、名額還回去;worker.scheduled 會呼叫它。
// 2026-09-27 由 /speckit-converge 抓到:T034 已打勾,但這條路徑沒有任何測試。
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync } from 'node:fs'
import { world, T0, DAY, MIN } from './helpers/world.js'
import { userWith, jsonReq } from './helpers/auth.js'
import { sweepExpired } from '../src/lib/db/holds.js'
import worker from '../src/worker.js'

let w, ev, tt, alice
const remaining = async () => (await w.db.prepare('SELECT remaining FROM ticket_types WHERE id = ?').bind(tt.id).first()).remaining

describe.skipIf(!existsSync('schema.sql'))('排程清掃', () => {
  beforeEach(async () => {
    w = await world()
    const staff = await userWith(w.app, w.env, w.db, 's@example.com', { staff: true })
    alice = await userWith(w.app, w.env, w.db, 'a@example.com')
    ev = await (await w.call('/events', jsonReq('POST', { name: 'x', opens_at: T0 - DAY, deadline_at: T0 + DAY }, staff.access))).json()
    tt = await (await w.call(`/events/${ev.id}/ticket-types`, jsonReq('POST', { name: '一般', price_cents: 100, capacity: 10 }, staff.access))).json()
    await w.call(`/events/${ev.id}/holds`, jsonReq('POST', { ticket_type_id: tt.id, seat_nos: ['A1', 'A2'] }, alice.access))
  })
  afterEach(() => w.dispose())

  it('還沒到期 → 什麼都不動', async () => {
    expect(await sweepExpired(w.db, T0 + 10 * MIN - 1)).toBe(0)
    expect(await remaining()).toBe(8)
  })

  it('到期 → 翻成 expired、列留著不刪、名額還回去(H4)', async () => {
    expect(await sweepExpired(w.db, T0 + 10 * MIN)).toBe(2)
    const rows = (await w.db.prepare('SELECT status FROM seat_holds').all()).results
    expect(rows.map((r) => r.status)).toEqual(['expired', 'expired'])
    expect(await remaining()).toBe(10)
    expect(await sweepExpired(w.db, T0 + 20 * MIN)).toBe(0)   // 再掃一次不會重複還
    expect(await remaining()).toBe(10)
  })

  it('worker.scheduled 用現在時間呼叫 sweepExpired', async () => {
    const waits = []
    await worker.scheduled({}, w.env, { waitUntil: (p) => waits.push(p) })
    await Promise.all(waits)
    expect(waits).toHaveLength(1)
    const rows = (await w.db.prepare('SELECT status FROM seat_holds').all()).results
    expect(rows.every((r) => r.status === 'expired')).toBe(true)   // 真實時鐘遠晚於 T0,早就過期
  })
})
