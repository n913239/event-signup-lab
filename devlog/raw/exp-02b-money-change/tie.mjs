// 平手專測:刻意讓兩種或三種折扣同額,看套用的是哪一種(作者規則:優惠碼 → 早鳥 → 團體)
import { quote as ours } from '../../../src/domain/money.js'
const norm = (k) => (k == null || k === 'none') ? 'none' : k
for (const r of ['A', 'B']) {
  const { quote: ai } = await import(new URL(`./${r}/money.js`, import.meta.url))
  let seed = 7, n = 0, diff = 0; const ex = {}
  const rnd = (k) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % k }
  for (let i = 0; i < 2000; i++) {
    const unit = 100 * (1 + rnd(3000)), qty = 1 + rnd(10), pct = 5 * (1 + rnd(6)), sub = unit * qty
    const mode = rnd(3)  // 0: 三者同額 1: 優惠碼=早鳥 2: 早鳥=團體
    const o = { unit_price_cents: unit, qty, group_min_qty: 1,
      early_bird_pct: pct, group_pct: mode === 1 ? 0 : pct, promo_cents: mode === 2 ? 0 : sub * pct / 100 }
    const a = ours(o), b = ai({ unit_price: o.unit_price_cents, qty, early_bird_pct: o.early_bird_pct, group_min_qty: 1, group_pct: o.group_pct, promo_amount: o.promo_cents })
    n++; const ka = norm(a.applied), kb = norm(b.applied ?? b.applied_discount)
    if (ka !== kb) { diff++; ex[`${ka}→${kb}`] = (ex[`${ka}→${kb}`] || 0) + 1 }
  }
  console.log(`${r}: 平手 ${n} 組,套用種類跟作者不同 ${diff} 組`, JSON.stringify(ex))
}
