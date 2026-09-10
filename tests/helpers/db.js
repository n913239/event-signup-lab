/**
 * 測試用的 D1。
 *
 * 用 wrangler 的 getPlatformProxy 拿真的 miniflare D1,不是 shim ——
 * shim 本身是一把沒驗過的尺,而這個專案的規則有一半靠 SQL 語意
 * (條件式寫入的 changes、部分唯一索引、batch 的原子性)。
 * 拿假的 SQLite 測,測到的是 shim 的行為,不是 D1 的。
 */
import { getPlatformProxy } from 'wrangler'
import { readFileSync, existsSync } from 'node:fs'

export async function withDb() {
  const proxy = await getPlatformProxy({ persist: false })
  const db = proxy.env.DB

  if (existsSync('schema.sql')) {
    // ⚠️ D1 的 exec() 不吃多行語句,要自己切開再 batch。
    const stmts = readFileSync('schema.sql', 'utf8')
      .split(/;\s*$/m)
      .map((x) => x.trim())
      .filter((x) => x && !x.startsWith('--'))
    await db.batch(stmts.map((sql) => db.prepare(sql)))
  }

  return { db, env: proxy.env, dispose: () => proxy.dispose() }
}
