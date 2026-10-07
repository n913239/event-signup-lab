// 比對作者擇優版(src/domain/money.js)與 AI 改版:四組向量 + 同一批 20,000 組(seed 20260927,同 exp-02 measure.mjs)
import { quote as ours } from '../../../src/domain/money.js'
const run = async (dir) => {
  const { quote: ai } = await import(new URL(dir + '/money.js', import.meta.url))
  const aiQ = (o) => ai({ unit_price: o.unit_price_cents, qty: o.qty, early_bird_pct: o.early_bird_pct, group_min_qty: o.group_min_qty, group_pct: o.group_pct, promo_amount: o.promo_cents })
  const kind = (q) => q.applied ?? q.applied_discount ?? 'none'
  const norm = (k) => (k === null || k === 'none') ? 'none' : k
  const base = { unit_price_cents: 0, qty: 1, early_bird_pct: 0, group_min_qty: 4, group_pct: 0, promo_cents: 0 }
  const vectors = [
    ['90000 平手', { unit_price_cents: 100000, early_bird_pct: 10, group_min_qty: 1, group_pct: 10, promo_cents: 10000 }],
    ['89999', { unit_price_cents: 33333, qty: 3, early_bird_pct: 10 }],
    ['promo > 應付', { unit_price_cents: 5000, promo_cents: 6000 }],
    ['未達團體門檻', { unit_price_cents: 100000, qty: 3, group_pct: 10 }],
  ]
  for (const [name, v] of vectors) { const o = { ...base, ...v }; const a = ours(o), b = aiQ(o)
    console.log(`  ${name.padEnd(8)} total ours=${a.total_cents} ai=${b.total}  applied ours=${norm(a.applied)} ai=${norm(kind(b))}`) }
  let seed = 20260927
  const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n }
  let tdiff = 0, maxGap = 0, kdiff = 0, kdiffSameTotal = 0, ex = null
  for (let i = 0; i < 20000; i++) {
    const o = { unit_price_cents: rnd(300000), qty: 1 + rnd(10), early_bird_pct: rnd(4) === 0 ? 0 : 5 * rnd(7), group_min_qty: 4, group_pct: rnd(3) === 0 ? 0 : 5 * rnd(5), promo_cents: rnd(3) === 0 ? 0 : 1000 * rnd(20) }
    const a = ours(o), b = aiQ(o)
    if (a.total_cents !== b.total) { tdiff++; const g = Math.abs(a.total_cents - b.total); if (g > maxGap) { maxGap = g; ex = { o, ours: a.total_cents, ai: b.total } } }
    if (norm(a.applied) !== norm(kind(b))) { kdiff++; if (a.total_cents === b.total) kdiffSameTotal++ }
  }
  console.log(`  fuzz 20000:total 不同 ${tdiff} 組(最大差 ${maxGap} 分);套用種類不同 ${kdiff} 組(其中 total 相同 ${kdiffSameTotal} 組)`, ex ? JSON.stringify(ex) : '')
}
for (const r of ['A', 'B']) { console.log('== ' + r); await run('./' + r) }
