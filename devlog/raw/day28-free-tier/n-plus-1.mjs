// Day 28:「我的票券」兩種寫法在遠端 D1 各實跑一次,比 rows_read。
//   JOIN = src/lib/db/orders.js 的 SELECT_ORDER(現行寫法,一次查詢)
//   N+1  = 先撈訂單 → 逐張撈活動名 → 逐張撈明細 → 逐席撈票種名(常見的天真寫法)
// 用法:node devlog/raw/day28-free-tier/n-plus-1.mjs <member email>
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// 用 --command 不用 --file:遠端的 --file 走匯入模式,輸出不是逐句結果。execFileSync 不經過 shell,SQL 不必跳脫。
const run = (sql) => JSON.parse(execFileSync('npx', ['wrangler', 'd1', 'execute', 'signup', '--remote', '--json', `--command=${sql}`],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 }))
const q = (s) => `'${String(s).replace(/'/g, "''")}'`
const sum = (rs) => rs.reduce((a, r) => a + r.meta.rows_read, 0)

const email = process.argv[2]
const mid = run(`SELECT id FROM members WHERE email = ${q(email)};`)[0].results[0].id

const SELECT_ORDER = readFileSync('src/lib/db/orders.js', 'utf8').match(/const SELECT_ORDER = `([\s\S]*?)`/)[1]
const join1 = run(`${SELECT_ORDER} WHERE o.member_id = ${q(mid)} ORDER BY o.confirmed_at DESC, o.id, i.seat_no;`)

// N+1 分三段送,但每一段裡是一句一個查詢,rows_read 逐句加總
const orders = run(`SELECT id, event_id, status, subtotal_cents, early_bird_pct, group_pct, promo_code, promo_cents, total_cents, confirmed_at FROM orders WHERE member_id = ${q(mid)} ORDER BY confirmed_at DESC, id;`)
const os = orders[0].results
const perOrder = run(os.map((o) => `SELECT name, owner_id FROM events WHERE id = ${q(o.event_id)};\nSELECT seat_no, ticket_type_id, unit_price_cents FROM order_items WHERE order_id = ${q(o.id)} ORDER BY seat_no;`).join('\n'))
const items = perOrder.filter((_, i) => i % 2 === 1).flatMap((r) => r.results)
const perItem = run(items.map((it) => `SELECT name FROM ticket_types WHERE id = ${q(it.ticket_type_id)};`).join('\n'))

const n1 = [...orders, ...perOrder, ...perItem]
const out = {
  orders: os.length, seats: items.length,
  join: { queries: 1, rows_returned: join1[0].results.length, rows_read: sum(join1) },
  n_plus_1: { queries: n1.length, rows_read: sum(n1) },
}
console.log(JSON.stringify(out, null, 1))
