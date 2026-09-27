// 金額引擎(Day 25)。規則由作者定(docs/spec.md「折扣怎麼算」,2026-09-27 改定);程式由寫作 session 寫。
// 全程整數分,不出現浮點(規則 I)。
//
// 三種折扣不疊加,只套讓應付最低的那一種;平手依序 優惠碼 → 早鳥 → 團體。
// 沒被選中的折扣在訂單上記 0 —— 看訂單就知道這次用了哪一種。

// 整數百分比,+50 是四捨五入(不用 Math.round,那個吃的是浮點)
export const applyPct = (cents, pct) => Math.floor((cents * (100 - pct) + 50) / 100)

export function quote({ unit_price_cents, qty, early_bird_pct, group_min_qty, group_pct, promo_cents }) {
  const subtotal_cents = unit_price_cents * qty
  const none = { subtotal_cents, applied: null, early_bird_pct: 0, group_pct: 0, promo_cents: 0, total_cents: subtotal_cents }

  // 候選的排列順序就是平手時的優先順序
  const candidates = []
  if (promo_cents > 0) {
    const off = Math.min(promo_cents, subtotal_cents)            // 只折到 0,記實際折抵
    candidates.push({ ...none, applied: 'promo', promo_cents: off, total_cents: subtotal_cents - off })
  }
  if (early_bird_pct > 0) {
    candidates.push({ ...none, applied: 'early_bird', early_bird_pct, total_cents: applyPct(subtotal_cents, early_bird_pct) })
  }
  if (group_pct > 0 && qty >= group_min_qty) {
    candidates.push({ ...none, applied: 'group', group_pct, total_cents: applyPct(subtotal_cents, group_pct) })
  }

  // 嚴格小於才換人:平手留給排在前面的
  return candidates.reduce((best, c) => (c.total_cents < best.total_cents ? c : best), none)
}
