// 金額引擎(Day 25)。規則由作者定(docs/spec.md「折扣怎麼算」,2026-09-27 改定:不疊加,擇優);
// 測試由寫作 session 依作者的規則寫成。
import { describe, it, expect } from 'vitest'
import { applyPct, quote } from '../../src/domain/money.js'

const base = { unit_price_cents: 0, qty: 1, early_bird_pct: 0, group_min_qty: 4, group_pct: 0, promo_cents: 0 }
const q = (over) => quote({ ...base, ...over })

describe('applyPct(整數百分比,+50 四捨五入)', () => {
  it.each([[100000, 10, 90000], [99999, 10, 89999], [100, 0, 100], [100, 100, 0], [1, 50, 1], [3, 50, 2]])(
    'applyPct(%i, %i) = %i', (c, p, want) => expect(applyPct(c, p)).toBe(want))
})

describe('quote:三種折扣只套一種,取應付最低的', () => {
  it('500 元、早鳥 20%、團體 10%、優惠 50 元 → 早鳥最優,400 元(不是疊加的 310)', () => {
    expect(q({ unit_price_cents: 50000, early_bird_pct: 20, group_min_qty: 1, group_pct: 10, promo_cents: 5000 })).toEqual({
      subtotal_cents: 50000, applied: 'early_bird', early_bird_pct: 20, group_pct: 0, promo_cents: 0, total_cents: 40000,
    })
  })

  it('平手依序選 優惠碼 → 早鳥 → 團體:1000 元三種都折 100 → 選優惠碼,900 元', () => {
    expect(q({ unit_price_cents: 100000, early_bird_pct: 10, group_min_qty: 1, group_pct: 10, promo_cents: 10000 })).toEqual({
      subtotal_cents: 100000, applied: 'promo', early_bird_pct: 0, group_pct: 0, promo_cents: 10000, total_cents: 90000,
    })
  })

  it('早鳥與團體平手、沒有優惠碼 → 選早鳥', () => {
    expect(q({ unit_price_cents: 100000, qty: 4, early_bird_pct: 10, group_pct: 10 }).applied).toBe('early_bird')
  })

  it('反向探針:不是疊加的 71000,也不是先減後乘的 72900', () => {
    const r = q({ unit_price_cents: 100000, early_bird_pct: 10, group_min_qty: 1, group_pct: 10, promo_cents: 10000 })
    expect(r.total_cents).not.toBe(71000)
    expect(r.total_cents).not.toBe(72900)
  })

  it('優惠碼沒被選中 → 不記在訂單上(promo_cents 0)', () => {
    const r = q({ unit_price_cents: 100000, qty: 4, group_pct: 20, promo_cents: 10000 })
    expect(r).toMatchObject({ applied: 'group', group_pct: 20, promo_cents: 0, total_cents: 320000 })
  })

  it('優惠碼大於小計:total 0,promo_cents 記實際折抵(5000,不是碼面額 6000)', () => {
    expect(q({ unit_price_cents: 5000, promo_cents: 6000 })).toEqual({
      subtotal_cents: 5000, applied: 'promo', early_bird_pct: 0, group_pct: 0, promo_cents: 5000, total_cents: 0,
    })
  })

  it('張數未達團體門檻不算候選;剛好達到才算', () => {
    expect(q({ unit_price_cents: 100000, qty: 3, group_min_qty: 4, group_pct: 10 })).toMatchObject({ applied: null, total_cents: 300000 })
    expect(q({ unit_price_cents: 100000, qty: 4, group_min_qty: 4, group_pct: 10 })).toMatchObject({ applied: 'group', total_cents: 360000 })
  })

  it('33333 × 3、早鳥 10 → 89999(整筆小計 99999 再打折,不逐座)', () => {
    expect(q({ unit_price_cents: 33333, qty: 3, early_bird_pct: 10 }).total_cents).toBe(89999)
  })

  it('沒有任何折扣 → applied null,小計原樣', () => {
    expect(q({ unit_price_cents: 123456, qty: 2 })).toEqual({
      subtotal_cents: 246912, applied: null, early_bird_pct: 0, group_pct: 0, promo_cents: 0, total_cents: 246912,
    })
  })

  it('不變條件(隨機 2,000 組):只有一種折扣有值、total 是三個候選裡最低的、非負整數、不超過小計', () => {
    let seed = 7
    const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n }
    for (let i = 0; i < 2000; i++) {
      const o = { unit_price_cents: rnd(300000), qty: 1 + rnd(8), early_bird_pct: 5 * rnd(8), group_min_qty: 4, group_pct: 5 * rnd(6), promo_cents: 1000 * rnd(30) }
      const r = quote(o)
      const nonZero = [r.early_bird_pct, r.group_pct, r.promo_cents].filter((x) => x > 0).length
      expect(nonZero).toBeLessThanOrEqual(1)
      const sub = o.unit_price_cents * o.qty
      const candidates = [sub, Math.max(0, sub - o.promo_cents), applyPct(sub, o.early_bird_pct), o.qty >= 4 ? applyPct(sub, o.group_pct) : sub]
      expect(r.total_cents).toBe(Math.min(...candidates))
      expect(Number.isInteger(r.total_cents) && r.total_cents >= 0 && r.total_cents <= sub).toBe(true)
    }
  })
})
