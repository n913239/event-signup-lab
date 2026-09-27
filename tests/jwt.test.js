// JWT 的六個邊界(Day 24)。第 7 項「簽章比對要常數時間」沒有測試會為它變紅,由 scripts/check-jwt-timing.sh 裁判。
// 只透過 HTTP 打:register → login → refresh / 受保護的 GET /orders。不碰表名,不假設 jwt.js 的函式介面。
// 2026-09-27:寫作 session 起草、作者審(EXPERIMENT-PROTOCOL 2026-09-27 定案);實作由乾淨 session 出(T011b)。
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync } from 'node:fs'
import { createApp } from '../src/app.js'
import { withDb } from './helpers/db.js'
import { fakeClock } from './helpers/clock.js'

const T0 = 1_790_000_000_000
const MIN = 60_000
const DAY = 86_400_000

let ctx, clock, app, env
const call = (path, init = {}) => app.request(path, init, env)
const json = (body, headers = {}) => ({
  method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
})
const bearer = (token) => ({ headers: { authorization: `Bearer ${token}` } })
const b64url = (obj) => btoa(JSON.stringify(obj)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
const unb64url = (s) => JSON.parse(atob(s.replace(/-/g, '+').replace(/_/g, '/')))

async function login() {
  const cred = { email: 'm@example.com', password: 'password123' }
  await call('/auth/register', json({ ...cred, nickname: 'm' }))
  const res = await call('/auth/login', json(cred))
  expect(res.status).toBe(200)
  return res.json()
}
const refresh = (token) => call('/auth/refresh', json({ refresh_token: token }))

describe.skipIf(!existsSync('schema.sql'))('JWT 六個邊界', () => {
  beforeEach(async () => {
    ctx = await withDb()
    env = { ...ctx.env, JWT_SECRET: 'test-secret-0123456789abcdef', QR_SECRET: 'qr-test' }
    clock = fakeClock(T0)
    app = createApp({ now: clock.now })
  })
  afterEach(() => ctx.dispose())

  it('1 過期:access 發出後滿 15 分鐘 → 401', async () => {
    const { access_token } = await login()
    clock.advance(15 * MIN)
    expect((await call('/orders', bearer(access_token))).status).toBe(401)
  })

  it('2 簽章竄改:改 payload 不改簽章 → 401', async () => {
    const { access_token } = await login()
    const [h, p, s] = access_token.split('.')
    const forged = `${h}.${b64url({ ...unb64url(p), role: 'staff' })}.${s}`
    expect((await call('/orders', bearer(forged))).status).toBe(401)
  })

  it('3 alg: none(無簽章)→ 401', async () => {
    const { access_token } = await login()
    const [, p] = access_token.split('.')
    const none = `${b64url({ alg: 'none', typ: 'JWT' })}.${p}.`
    expect((await call('/orders', bearer(none))).status).toBe(401)
  })

  it('4 重放:已輪替的 refresh 再用一次 → 401,而且該成員全部 refresh 一起撤銷', async () => {
    const first = await login()
    const rotated = await (await refresh(first.refresh_token)).json()
    expect((await refresh(first.refresh_token)).status).toBe(401)          // 重放舊的
    expect((await refresh(rotated.refresh_token)).status).toBe(401)        // 新的也跟著被撤
  })

  it('5 效期:access 15 分鐘、refresh 30 天,邊界前 1 毫秒還有效', async () => {
    const { access_token, refresh_token } = await login()
    clock.set(T0 + 15 * MIN - 1)
    expect((await call('/orders', bearer(access_token))).status).not.toBe(401)
    clock.set(T0 + 30 * DAY - 1)
    expect((await refresh(refresh_token)).status).toBe(200)
    const { refresh_token: r2 } = await login()
    clock.set(T0 + 30 * DAY - 1 + 30 * DAY)                                 // r2 在上一行的時間發出,滿 30 天
    expect((await refresh(r2)).status).toBe(401)
  })

  it('6 格式異常:無 header / 非 Bearer / 空字串 / 亂碼 → 401,不是 500', async () => {
    const cases = [
      {}, { headers: { authorization: 'Basic abc' } }, { headers: { authorization: 'Bearer ' } },
      { headers: { authorization: 'Bearer abc.def' } }, { headers: { authorization: 'Bearer a.b.c' } },
    ]
    for (const init of cases) expect((await call('/orders', init)).status).toBe(401)
  })
})
