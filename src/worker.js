import { createApp } from './app.js'

const app = createApp()

export default {
  fetch: (request, env, ctx) => app.fetch(request, env, ctx),

  // 定期清掉沒有人來搶的過期 hold。
  // 它是 Day 27 三方競態裡的第三方 —— 搶位的那一批 SQL 自己會先翻
  // status(見 docs/spec.md「座位釋放的機制」),這支負責沒人搶的那些。
  // 骨架階段先留空殼,等 schema 落地再接。
  async scheduled(event, env, ctx) {
    // TODO(9/19):ctx.waitUntil(sweepExpired(env.DB, Date.now()))
  },
}
