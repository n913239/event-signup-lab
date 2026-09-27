// 金額引擎(Day 25)。規則由作者定(docs/spec.md「折扣的套用順序」+ 2026-09-27:promo_cents 記實際折抵);
// 程式由寫作 session 寫。全程整數分,不出現浮點(規則 I)。
//
// 順序:整筆小計 → 早鳥 % → 團體 %(張數達門檻才套)→ 減優惠碼(現金券,不被百分比稀釋)。

// 整數百分比,+50 是四捨五入(不用 Math.round,那個吃的是浮點)
export const applyPct = (cents, pct) => Math.floor((cents * (100 - pct) + 50) / 100)

export function quote({ unit_price_cents, qty, early_bird_pct, group_min_qty, group_pct, promo_cents }) {
  const subtotal_cents = unit_price_cents * qty
  const after_early_bird_cents = applyPct(subtotal_cents, early_bird_pct)
  const after_group_cents = qty >= group_min_qty ? applyPct(after_early_bird_cents, group_pct) : after_early_bird_cents
  // 優惠碼大於應付時只折到 0;訂單記的是實際折抵,不是碼面額
  const applied_promo_cents = Math.min(promo_cents, after_group_cents)
  return {
    subtotal_cents,
    after_early_bird_cents,
    after_group_cents,
    promo_cents: applied_promo_cents,
    total_cents: after_group_cents - applied_promo_cents,
  }
}
