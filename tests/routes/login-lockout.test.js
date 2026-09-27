// 登入失敗鎖定(作者 2026-09-27 定):連續錯 5 次開始鎖,5 → 10 → 20 → 40 → 60 分鐘(上限 1 小時),成功就歸零。
// 鎖定中一律 401,不透露「被鎖了」;鎖定期間的嘗試不累計。
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync } from 'node:fs'
import { world, T0, MIN } from '../helpers/world.js'
import { register } from '../helpers/auth.js'

let w
const EMAIL = 'lock@example.com'
const attempt = (password) => w.call('/auth/login', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password }),
})
const fail = async (n) => { for (let i = 0; i < n; i++) expect((await attempt('wrong-password')).status).toBe(401) }
const good = () => attempt('password123')

describe.skipIf(!existsSync('schema.sql'))('登入失敗鎖定', () => {
  beforeEach(async () => { w = await world(); await register(w.app, w.env, { email: EMAIL }) })
  afterEach(() => w.dispose())

  it('錯 4 次還能登入,而且成功後歸零', async () => {
    await fail(4)
    expect((await good()).status).toBe(200)
    await fail(4)
    expect((await good()).status).toBe(200)
  })

  it('錯第 5 次 → 鎖 5 分鐘:密碼對也 401,回應跟密碼錯一樣', async () => {
    await fail(5)
    const res = await good()
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('unauthorized')
  })

  it('鎖滿 5 分鐘後可以登入', async () => {
    await fail(5)
    w.clock.set(T0 + 5 * MIN - 1)
    expect((await good()).status).toBe(401)
    w.clock.set(T0 + 5 * MIN)
    expect((await good()).status).toBe(200)
  })

  it('解鎖後再錯一次 → 鎖 10 分鐘;再錯 → 20 分鐘', async () => {
    await fail(5)
    w.clock.set(T0 + 5 * MIN); await fail(1)
    w.clock.set(T0 + 5 * MIN + 10 * MIN - 1)
    expect((await good()).status).toBe(401)
    w.clock.set(T0 + 15 * MIN); await fail(1)
    w.clock.set(T0 + 15 * MIN + 20 * MIN - 1)
    expect((await good()).status).toBe(401)
    w.clock.set(T0 + 35 * MIN)
    expect((await good()).status).toBe(200)
  })

  it('累加上限 1 小時', async () => {
    await fail(5)
    let t = T0
    for (const lock of [5, 10, 20, 40, 60]) { t += lock * MIN; w.clock.set(t); await fail(1) }   // 這一次錯 → 鎖 60(不是 80)
    w.clock.set(t + 60 * MIN - 1)
    expect((await good()).status).toBe(401)
    w.clock.set(t + 60 * MIN)
    expect((await good()).status).toBe(200)
  })

  it('鎖定期間的嘗試不累計(不會越鎖越久)', async () => {
    await fail(5)
    w.clock.set(T0 + MIN); await fail(10)
    w.clock.set(T0 + 5 * MIN)
    expect((await good()).status).toBe(200)
  })

  it('不存在的 email 也回同樣的 401', async () => {
    const res = await w.call('/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'nobody@example.com', password: 'x' }) })
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('unauthorized')
  })
})
