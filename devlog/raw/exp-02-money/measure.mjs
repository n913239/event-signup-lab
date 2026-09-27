// 用作者的向量與 20,000 組隨機輸入,比對作者規則版(src/domain/money.js)與 AI 版的 total。
import { quote as ours } from '../../../src/domain/money.js'
import { quote as ai } from './money.ai.js'

const aiQ = (o) => ai({ unit_price: o.unit_price_cents, qty: o.qty, early_bird_pct: o.early_bird_pct, group_min_qty: o.group_min_qty, group_pct: o.group_pct, promo_amount: o.promo_cents })
const base = { unit_price_cents: 0, qty: 1, early_bird_pct: 0, group_min_qty: 4, group_pct: 0, promo_cents: 0 }
const vectors = [
  ['71000', { unit_price_cents: 100000, early_bird_pct: 10, group_min_qty: 1, group_pct: 10, promo_cents: 10000 }],
  ['89999', { unit_price_cents: 33333, qty: 3, early_bird_pct: 10 }],
  ['promo > 應付', { unit_price_cents: 5000, promo_cents: 6000 }],
  ['未達團體門檻', { unit_price_cents: 100000, qty: 3, group_pct: 10 }],
]
for (const [name, v] of vectors) {
  const o = { ...base, ...v }
  console.log(`${name.padEnd(8)} ours=${ours(o).total_cents} ai=${aiQ(o).total} promo ours=${ours(o).promo_cents} ai=${aiQ(o).promo_discount}`)
}
let seed = 20260927
const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n }
let diff = 0, maxGap = 0, example = null
for (let i = 0; i < 20000; i++) {
  const o = { unit_price_cents: rnd(300000), qty: 1 + rnd(10), early_bird_pct: rnd(4) === 0 ? 0 : 5 * rnd(7), group_min_qty: 4, group_pct: rnd(3) === 0 ? 0 : 5 * rnd(5), promo_cents: rnd(3) === 0 ? 0 : 1000 * rnd(20) }
  const a = ours(o).total_cents, b = aiQ(o).total
  if (a !== b) { diff++; if (Math.abs(a - b) > maxGap) { maxGap = Math.abs(a - b); example = { o, ours: a, ai: b } } }
}
console.log(`fuzz 20000 組:不同 ${diff} 組,最大差 ${maxGap}`, JSON.stringify(example))
