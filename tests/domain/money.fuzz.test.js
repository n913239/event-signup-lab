// 金額引擎 fuzz(Day 25):20,000 組隨機輸入,檢查不管選哪個算法都必須成立的不變條件,
// 再加一個獨立寫的對照算法(oracle)逐組比 total。
// 亂數用固定 seed 的 mulberry32 —— 紅了要能用同一個 seed 重現,不可重現的 fuzz 等於沒有。
import { describe, it, expect } from 'vitest'
import { quote } from '../../src/domain/money.js'

const SEED = Number(process.env.FUZZ_SEED ?? 20260927)
const N = Number(process.env.FUZZ_N ?? 20_000)

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// 對照算法:不共用 money.js 的任何一行。四捨五入用 BigInt 做「折後金額 = 小計 × (100 − pct) / 100,.5 進位」,
// 擇優與平手順序照 docs/spec.md 直接寫成排序,不用 reduce。
function oracle({ unit_price_cents, qty, early_bird_pct, group_min_qty, group_pct, promo_cents }) {
  const sub = BigInt(unit_price_cents) * BigInt(qty)
  const pct = (p) => (sub * BigInt(100 - p) * 2n + 100n) / 200n          // round half up
  const c = [{ rank: 3, applied: null, total: sub }]
  if (promo_cents > 0) c.push({ rank: 0, applied: 'promo', total: sub > BigInt(promo_cents) ? sub - BigInt(promo_cents) : 0n })
  if (early_bird_pct > 0) c.push({ rank: 1, applied: 'early_bird', total: pct(early_bird_pct) })
  if (group_pct > 0 && qty >= group_min_qty) c.push({ rank: 2, applied: 'group', total: pct(group_pct) })
  // 只有嚴格更低才換;同額時優惠碼 → 早鳥 → 團體,都比「不套」優先 —— 但「不套」只在沒有任何候選更低時留下
  const best = c.filter((x) => x.applied !== null && x.total < sub)
    .sort((a, b) => (a.total < b.total ? -1 : a.total > b.total ? 1 : a.rank - b.rank))[0]
  return best ? { applied: best.applied, total: Number(best.total) } : { applied: null, total: Number(sub) }
}

function input(rnd) {
  const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1))
  const maybe = (p, v) => (rnd() < p ? v : 0)
  return {
    unit_price_cents: rnd() < 0.05 ? 0 : int(1, 500_000),                 // 5% 是 0 元票種(M3)
    qty: int(1, 10),                                                      // H1:一次最多 10 席
    early_bird_pct: maybe(0.6, int(1, 100)),
    group_min_qty: int(2, 10),
    group_pct: maybe(0.6, int(1, 100)),
    promo_cents: maybe(0.6, int(1, 600_000)),
  }
}

describe(`money fuzz(seed ${SEED}、${N} 組)`, () => {
  it('五條不變條件 + 對照算法,違反數 = 0', () => {
    const rnd = mulberry32(SEED)
    const bad = { negative: 0, overSubtotal: 0, notInteger: 0, nondeterministic: 0, breakdown: 0, oracle: 0 }
    let firstBad = null
    const note = (k, i) => { bad[k]++; firstBad ??= { rule: k, input: i } }
    for (let n = 0; n < N; n++) {
      const i = input(rnd)
      const q = quote(i)
      if (q.total_cents < 0) note('negative', i)
      if (q.total_cents > q.subtotal_cents) note('overSubtotal', i)
      if (!Number.isInteger(q.total_cents) || !Number.isInteger(q.subtotal_cents)) note('notInteger', i)
      if (JSON.stringify(quote(i)) !== JSON.stringify(q)) note('nondeterministic', i)
      // 明細加總 = 總額:小計 − 套用那一種的折抵 = total;沒套用的兩種必須是 0
      const off = q.subtotal_cents - q.total_cents
      const ok = q.applied === null ? off === 0 && q.promo_cents === 0 && q.early_bird_pct === 0 && q.group_pct === 0
        : q.applied === 'promo' ? q.promo_cents === off && q.early_bird_pct === 0 && q.group_pct === 0
        : q.applied === 'early_bird' ? q.promo_cents === 0 && q.group_pct === 0 && q.early_bird_pct === i.early_bird_pct
        : q.promo_cents === 0 && q.early_bird_pct === 0 && q.group_pct === i.group_pct
      if (!ok) note('breakdown', i)
      const o = oracle(i)
      if (o.total !== q.total_cents || o.applied !== q.applied) note('oracle', i)
    }
    console.log(`money fuzz seed=${SEED} n=${N}`, JSON.stringify(bad), firstBad ? `first=${JSON.stringify(firstBad)}` : '')
    expect(bad).toEqual({ negative: 0, overSubtotal: 0, notInteger: 0, nondeterministic: 0, breakdown: 0, oracle: 0 })
  })
})
