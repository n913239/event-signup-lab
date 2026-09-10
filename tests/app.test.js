import { describe, it, expect } from 'vitest'
import { createApp } from '../src/app.js'

const app = createApp()
const call = (path, init) => app.request(path, init, {})

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
const ENDPOINTS = [
  ['POST', '/auth/register'], ['POST', '/auth/login'],
  ['POST', '/auth/refresh'], ['POST', '/auth/logout'],
  ['POST', '/events'], ['GET', '/events'], ['GET', '/events/1'],
  ['PATCH', '/events/1'], ['POST', '/events/1/close'],
  ['POST', '/events/1/ticket-types'], ['PATCH', '/ticket-types/1'],
  ['POST', '/events/1/holds'], ['DELETE', '/holds/1'],
  ['POST', '/holds/1/confirm'],
  ['GET', '/orders'], ['GET', '/orders/1'], ['POST', '/orders/1/cancel'],
]

describe('17 條 endpoint 都接上了', () => {
  it('剛好 17 條,一條不多一條不少', () => {
    expect(ENDPOINTS).toHaveLength(17)
  })

  it.each(ENDPOINTS)('%s %s → 501', async (method, path) => {
    const res = await call(path, { method })
    expect(res.status).toBe(501)
    expect((await res.json()).error).toBe('not_implemented')
  })
})
