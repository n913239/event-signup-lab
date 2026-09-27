import { describe, it, expect } from 'vitest'
import { createApp } from '../src/app.js'

import { sign } from '../src/lib/jwt.js'

const app = createApp()
const ENV = { JWT_SECRET: 'app-test-secret' }
const call = (path, init) => app.request(path, init, ENV)

describe('骨架', () => {
  it('/health 回 ok 與伺服器時間', async () => {
    const res = await call('/health')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(typeof body.server_now).toBe('number')
  })

  it('每個 JSON 回應都帶 x-server-now', async () => {
    const res = await call('/health')
    expect(res.headers.get('x-server-now')).toBeTruthy()
  })

  it('查無路由回 404 而不是 500', async () => {
    const res = await call('/nope')
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('not_found')
  })
})

// 規格的 17 條。骨架階段全部回 501 —— 這個測試證明「路由接對了」,
// 不是證明「功能做好了」。每接好一條,就把它從這裡搬到自己的測試檔。
// 2026-09-27:auth 四條已實作,移出 501 清單(測試在 tests/jwt.test.js)。其餘要登入,帶一個合法 token 打。
const PROTECTED = [
  ['POST', '/events'], ['GET', '/events'], ['GET', '/events/1'],
  ['PATCH', '/events/1'], ['POST', '/events/1/close'],
  ['POST', '/events/1/ticket-types'], ['PATCH', '/ticket-types/1'],
  ['POST', '/events/1/holds'], ['DELETE', '/holds/1'],
  ['POST', '/holds/1/confirm'],
  ['GET', '/orders'], ['GET', '/orders/1'], ['POST', '/orders/1/cancel'],
]
// 2026-09-27:活動 5 條、票種 2 條已實作(tests/routes/),移出 501 清單。
const ENDPOINTS = PROTECTED.filter(([m, p]) => !/^\/(events|ticket-types)(\/1)?(\/close|\/ticket-types)?$/.test(p))

describe('尚未實作的 6 條:登入後回 501', () => {
  it('剛好 6 條(17 − auth 4 − 活動 5 − 票種 2)', () => {
    expect(ENDPOINTS).toHaveLength(6)
  })

  it.each(ENDPOINTS)('%s %s → 501', async (method, path) => {
    const token = await sign({ sub: 'm1', role: 'member' }, ENV.JWT_SECRET, Date.now())
    const res = await call(path, { method, headers: { authorization: `Bearer ${token}` } })
    expect(res.status).toBe(501)
    expect((await res.json()).error).toBe('not_implemented')
  })
})

describe('時鐘注入', () => {
  it('createApp({ now }) 用注入的時鐘,不讀系統時間', async () => {
    const { fakeClock } = await import('./helpers/clock.js')
    const clock = fakeClock(1_790_000_000_000)
    const fixed = createApp({ now: clock.now })
    let body = await (await fixed.request('/health', {}, {})).json()
    expect(body.server_now).toBe(1_790_000_000_000)
    clock.advance(600_000)
    body = await (await fixed.request('/health', {}, {})).json()
    expect(body.server_now).toBe(1_790_000_600_000)
  })
})

describe('沒登入', () => {
  it.each(PROTECTED)('%s %s → 401', async (method, path) => {
    expect((await call(path, { method })).status).toBe(401)
  })
})
