import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { auth } from './routes/auth.js'
import { events } from './routes/events.js'
import { ticketTypes } from './routes/ticket-types.js'
import { holds } from './routes/holds.js'
import { orders } from './routes/orders.js'

// now 從外面注入:正式環境用 Date.now,測試傳假時鐘(tests/helpers/clock.js)。
// 「剛好等於開賣」「剛好逾時」這種邊界,只有時鐘可控才測得到。
export function createApp({ now = Date.now } = {}) {
  const app = new Hono()

  // 每個回應都帶伺服器的現在時間。
  // 前端的倒數計時一律以這個為準,不用瀏覽器的時鐘 —— 使用者的機器
  // 可能慢五分鐘,而「保留還剩幾秒」是伺服器說了算。
  // 這裡是整個系統唯一取現在時間的地方之一(另一處是 scheduled)。
  app.use('*', async (c, next) => {
    c.set('now', now())
    await next()
    if (c.res.headers.get('content-type')?.includes('application/json')) {
      c.res.headers.set('x-server-now', String(c.get('now')))
    }
  })

  // web(Pages)跨網域呼叫;x-server-now 要 expose,前端倒數才讀得到。
  app.use('*', (c, next) => cors({
    origin: c.env?.CORS_ORIGIN ?? 'http://localhost:5173',
    allowHeaders: ['authorization', 'content-type'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    exposeHeaders: ['x-server-now'],
  })(c, next))

  app.get('/health', (c) =>
    c.json({ ok: true, server_now: c.get('now') }))

  app.route('/auth', auth)
  app.route('/events', events)
  app.route('/ticket-types', ticketTypes)
  app.route('/holds', holds)
  app.route('/orders', orders)

  // 錯誤不吐堆疊。回應的形狀跟契約一致,契約測試才驗得到錯誤路徑。
  app.onError((err, c) => {
    console.error(err)
    return c.json({ error: 'internal', server_now: c.get('now') }, 500)
  })
  app.notFound((c) => c.json({ error: 'not_found' }, 404))

  return app
}
