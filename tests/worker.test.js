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
    expect(waits).toHaveLength(2)   // 清 hold + 結束活動(Q24)
    const rows = (await w.db.prepare('SELECT status FROM seat_holds').all()).results
    expect(rows.every((r) => r.status === 'expired')).toBe(true)   // 真實時鐘遠晚於 T0,早就過期
    expect((await w.db.prepare('SELECT status FROM events WHERE id = ?').bind(ev.id).first()).status).toBe('finished')
  })
})

// Q24(作者 2026-09-27 定):過了截止時間由排程轉 finished。
// 時間點 = deadline_at + hold_ttl_minutes:截止前一刻建的保留還能確認完,轉了也不影響確認(確認不看活動狀態,C13)。
// 狀態機沒有 on_sale → finished,所以 on_sale 的先 close 再 finish(同一個 batch)。
describe.skipIf(!existsSync('schema.sql'))('排程結束活動(Q24)', () => {
  let staff
  const status = async (id) => (await w.db.prepare('SELECT status FROM events WHERE id = ?').bind(id).first()).status
  beforeEach(async () => {
    w = await world()
    staff = await userWith(w.app, w.env, w.db, 's@example.com', { staff: true })
  })
  afterEach(() => w.dispose())

  it('截止 + 保留時長之前不動;到了 on_sale 與 closed 都轉 finished;draft 不動', async () => {
    const { finishPastDeadline } = await import('../src/lib/db/events.js')
    const a = await (await w.call('/events', jsonReq('POST', { name: 'a', opens_at: T0 - DAY, deadline_at: T0 + DAY }, staff.access))).json()
    const b = await (await w.call('/events', jsonReq('POST', { name: 'b', opens_at: T0 - DAY, deadline_at: T0 + DAY }, staff.access))).json()
    await w.db.prepare("UPDATE events SET status = 'closed' WHERE id = ?").bind(b.id).run()
    const d = await (await w.call('/events', jsonReq('POST', { name: 'd', opens_at: T0 - DAY, deadline_at: T0 + DAY }, staff.access))).json()
    await w.db.prepare("UPDATE events SET status = 'draft' WHERE id = ?").bind(d.id).run()
    const end = T0 + DAY + 10 * MIN                                   // hold_ttl_minutes 預設 10
    expect(await finishPastDeadline(w.db, end - 1)).toBe(0)
    expect([await status(a.id), await status(b.id)]).toEqual(['on_sale', 'closed'])
    expect(await finishPastDeadline(w.db, end)).toBe(2)
    expect([await status(a.id), await status(b.id), await status(d.id)]).toEqual(['finished', 'finished', 'draft'])
    expect(await finishPastDeadline(w.db, end + DAY)).toBe(0)         // 再跑一次不重複
  })
})
