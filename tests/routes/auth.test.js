// US3 補(T035):refresh 與 logout 的路由行為。重放與效期的邊界在 tests/jwt.test.js。
// 2026-09-27 由 /speckit-analyze 抓到:T036 已打勾,但 logout 在 tests/ 裡沒有任何測試。
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync } from 'node:fs'
import { world, DAY } from '../helpers/world.js'
import { register, login, jsonReq } from '../helpers/auth.js'

let w, me
const refresh = (token) => w.call('/auth/refresh', jsonReq('POST', { refresh_token: token }))

describe.skipIf(!existsSync('schema.sql'))('refresh 與 logout', () => {
  beforeEach(async () => {
    w = await world()
    await register(w.app, w.env, { email: 'a@example.com' })
    me = await login(w.app, w.env, { email: 'a@example.com' })
  })
  afterEach(() => w.dispose())

  it('refresh 成功 → 新的一對,而且跟舊的不同', async () => {
    const res = await refresh(me.refresh)
    expect(res.status).toBe(200)
    const pair = await res.json()
    expect(pair.refresh_token).not.toBe(me.refresh)
    expect(pair.access_token).toBeTruthy()
  })

  it('重放舊的 refresh → 401 refresh_replayed', async () => {
    await refresh(me.refresh)
    const res = await refresh(me.refresh)
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('refresh_replayed')
  })

  it('refresh 過期 → 401 unauthorized', async () => {
    w.clock.advance(30 * DAY)
    const res = await refresh(me.refresh)
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('unauthorized')
  })

  it('logout → 204,之後這個 refresh 換不到新的', async () => {
    expect((await w.call('/auth/logout', jsonReq('POST', { refresh_token: me.refresh }, me.access))).status).toBe(204)
    expect((await refresh(me.refresh)).status).toBe(401)
  })

  it('logout 不帶 body / 沒有 refresh_token → 400', async () => {
    expect((await w.call('/auth/logout', { method: 'POST', headers: { authorization: `Bearer ${me.access}` } })).status).toBe(400)
    expect((await w.call('/auth/logout', jsonReq('POST', {}, me.access))).status).toBe(400)
  })

  it('logout 沒帶 access token → 401', async () => {
    expect((await w.call('/auth/logout', jsonReq('POST', { refresh_token: me.refresh }))).status).toBe(401)
  })
})
