// 每個路由測試的共同開場:真的 miniflare D1 + schema、假時鐘、app。
import { createApp } from '../../src/app.js'
import { withDb } from './db.js'
import { fakeClock } from './clock.js'

export const T0 = 1_790_000_000_000
export const MIN = 60_000
export const DAY = 86_400_000

export async function world() {
  const ctx = await withDb()
  const env = { ...ctx.env, JWT_SECRET: 'test-secret-0123456789abcdef', QR_SECRET: 'qr-test-secret' }
  const clock = fakeClock(T0)
  const app = createApp({ now: clock.now })
  const call = (path, init = {}) => app.request(path, init, env)
  return { db: ctx.env.DB, env, clock, app, call, dispose: ctx.dispose }
}
