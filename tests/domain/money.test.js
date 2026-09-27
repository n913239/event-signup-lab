// 金額引擎(Day 25)。規則由作者定(docs/spec.md 折扣節 + 2026-09-27 定案:promo_cents 記實際折抵);
// 測試由寫作 session 依作者的向量寫成。實作 src/domain/money.js 由作者手寫(AI 尚未介入)。
import { describe, it, expect } from 'vitest'
import { applyPct, quote } from '../../src/domain/money.js'

const base = { unit_price_cents: 0, qty: 1, early_bird_pct: 0, group_min_qty: 4, group_pct: 0, promo_cents: 0 }
const q = (over) => quote({ ...base, ...over })

describe('applyPct(整數百分比,+50 四捨五入)', () => {
  it.each([[100000, 10, 90000], [99999, 10, 89999], [100, 0, 100], [100, 100, 0], [1, 50, 1], [3, 50, 2]])(
    'applyPct(%i, %i) = %i', (c, p, want) => expect(applyPct(c, p)).toBe(want))
})

describe('quote:先乘後減、整筆小計', () => {
  it('100000、早鳥 10、團體 10、優惠 10000 → 71000', () => {
    const r = q({ unit_price_cents: 100000, early_bird_pct: 10, group_min_qty: 1, group_pct: 10, promo_cents: 10000 })
    expect(r).toEqual({ subtotal_cents: 100000, after_early_bird_cents: 90000, after_group_cents: 81000, promo_cents: 10000, total_cents: 71000 })
  })

  it('反向探針:不是先減後乘的 72900,也不是三個並聯扣原價的 70000', () => {
    const r = q({ unit_price_cents: 100000, early_bird_pct: 10, group_min_qty: 1, group_pct: 10, promo_cents: 10000 })
    expect(r.total_cents).not.toBe(72900)
    expect(r.total_cents).not.toBe(70000)
  })

  it('33333 × 3、早鳥 10 → 89999(整筆小計 99999 再打折,不逐座)', () => {
    expect(q({ unit_price_cents: 33333, qty: 3, early_bird_pct: 10 }).total_cents).toBe(89999)
  })

  it('優惠碼大於應付:total 0,promo_cents 記實際折抵(5000,不是碼面額 6000)', () => {
    expect(q({ unit_price_cents: 5000, promo_cents: 6000 })).toEqual({
      subtotal_cents: 5000, after_early_bird_cents: 5000, after_group_cents: 5000, promo_cents: 5000, total_cents: 0,
    })
  })

  it('張數未達團體門檻不套團體;剛好達到才套', () => {
    expect(q({ unit_price_cents: 100000, qty: 3, group_min_qty: 4, group_pct: 10 }).total_cents).toBe(300000)
    expect(q({ unit_price_cents: 100000, qty: 4, group_min_qty: 4, group_pct: 10 }).total_cents).toBe(360000)
  })

  it('沒有任何折扣 → 小計原樣', () => {
    expect(q({ unit_price_cents: 123456, qty: 2 }).total_cents).toBe(246912)
  })

  it('不變條件:subtotal − 早鳥折掉的 − 團體折掉的 − promo_cents = total', () => {
    for (const [u, n, eb, g, p] of [[100000, 4, 10, 10, 10000], [5000, 1, 0, 0, 6000], [33333, 3, 10, 0, 0], [77777, 5, 15, 20, 99999]]) {
      const r = q({ unit_price_cents: u, qty: n, early_bird_pct: eb, group_min_qty: 4, group_pct: g, promo_cents: p })
      expect(r.after_group_cents - r.promo_cents).toBe(r.total_cents)
      expect(r.total_cents).toBeGreaterThanOrEqual(0)
      expect(Number.isInteger(r.total_cents)).toBe(true)
    }
  })
})
