import { createApp } from './app.js'
import { sweepExpired } from './lib/db/holds.js'
import { finishPastDeadline } from './lib/db/events.js'

const app = createApp()

export default {
  fetch: (request, env, ctx) => app.fetch(request, env, ctx),

  // 定期清掉沒有人來搶的過期 hold。
  // 它是 Day 27 三方競態裡的第三方 —— 搶位的那一批 SQL 自己會先翻
  // status(見 docs/spec.md「座位釋放的機制」),這支負責沒人搶的那些。
  async scheduled(event, env, ctx) {
    const now = Date.now()
    ctx.waitUntil(sweepExpired(env.DB, now).then((n) => console.log(`sweepExpired: ${n} 席`)))
    // 過了截止 + 保留時長的活動轉 finished(Q24)
    ctx.waitUntil(finishPastDeadline(env.DB, now).then((n) => console.log(`finishPastDeadline: ${n} 場`)))
  },
}
