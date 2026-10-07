// 活動報名訂單金額計算
//
// 折扣不疊加:早鳥、團體、優惠碼三種各自以小計為基準算出折扣額,
// 一筆訂單只套用其中一種 —— 讓應付金額最低(折扣額最大)的那一種。
//   1. 小計       = unit_price × qty
//   2. 早鳥折扣   = 小計 × early_bird_pct%
//   3. 團體折扣   = 小計 × group_pct%               ← qty ≥ group_min_qty 才適用
//   4. 優惠碼折抵 = min(promo_amount, 小計)          ← 應付金額不會變成負數
// 折扣額相同時,依早鳥 → 團體 → 優惠碼的順序取第一個;三者皆為 0 則不套用任何折扣。
//
// 金額以整數元計算,折扣四捨五入到整數元,
// 所以 subtotal − discount_total === total 一定成立,不會有對不上的零頭。

function num(input, key, { integer = false, min = 0, max = Infinity, fallback } = {}) {
  const value = input[key] ?? fallback;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${key} 必須是數字,收到 ${JSON.stringify(input[key])}`);
  }
  if (integer && !Number.isInteger(value)) {
    throw new RangeError(`${key} 必須是整數,收到 ${value}`);
  }
  if (value < min || value > max) {
    const range = max === Infinity ? `≥ ${min}` : `介於 ${min} 到 ${max}`;
    throw new RangeError(`${key} 必須 ${range},收到 ${value}`);
  }
  return value;
}

// 百分比折扣金額,四捨五入到整數元(金額皆為非負,Math.round 即為四捨五入)
function pctOf(amount, pct) {
  return Math.round((amount * pct) / 100);
}

export function quote(input) {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('input 必須是物件');
  }

  const unitPrice = num(input, 'unit_price', { integer: true });
  const qty = num(input, 'qty', { integer: true, min: 1 });
  const earlyBirdPct = num(input, 'early_bird_pct', { max: 100, fallback: 0 });
  const groupMinQty = num(input, 'group_min_qty', { integer: true, fallback: 0 });
  const groupPct = num(input, 'group_pct', { max: 100, fallback: 0 });
  const promoAmount = num(input, 'promo_amount', { integer: true, fallback: 0 });

  const subtotal = unitPrice * qty;
  if (!Number.isSafeInteger(subtotal)) {
    throw new RangeError(`小計 ${subtotal} 超出可精確計算的範圍`);
  }

  const groupEligible = groupMinQty > 0 && groupPct > 0 && qty >= groupMinQty;
  const candidates = [
    { kind: 'early_bird', amount: pctOf(subtotal, earlyBirdPct) },
    { kind: 'group', amount: groupEligible ? pctOf(subtotal, groupPct) : 0 },
    { kind: 'promo', amount: Math.min(promoAmount, subtotal) },
  ];

  // 取折扣額最大者;同額時保留先出現的(早鳥 → 團體 → 優惠碼)
  let best = null;
  for (const c of candidates) {
    if (c.amount > 0 && (best === null || c.amount > best.amount)) best = c;
  }
  const applied = best ? best.kind : null;
  const discount = best ? best.amount : 0;

  return {
    subtotal,
    early_bird_discount: applied === 'early_bird' ? discount : 0,
    group_discount: applied === 'group' ? discount : 0,
    group_applied: applied === 'group',
    promo_discount: applied === 'promo' ? discount : 0,
    applied_discount: applied,
    discount_total: discount,
    total: subtotal - discount,
  };
}
