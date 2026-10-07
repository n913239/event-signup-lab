// 活動報名訂單金額計算
//
// 折扣不疊加:早鳥、團體、優惠碼三種只套用一種,選讓應付金額最低的那一種。
// 小計 = unit_price × qty,三種折扣都以小計為基準:
//   早鳥   = 小計 × early_bird_pct%
//   團體   = 小計 × group_pct%                ← qty ≥ group_min_qty 才適用
//   優惠碼 = min(promo_amount, 小計)           ← 應付金額不會變成負數,記實際折抵金額
// 折抵金額為 0 視為不符合;三種都不符合就是原價(applied = 'none')。
// 平手時依序選:優惠碼 → 早鳥 → 團體。沒被選中的折扣欄位一律為 0,
// 所以 promo_discount > 0 才代表優惠碼被用掉。
//
// 金額以整數元計算,百分比折扣四捨五入到整數元,
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

  // 依平手優先順序排列;只有折得更多(應付更低)才會取代前面的選項
  const candidates = [
    { type: 'promo', discount: Math.min(promoAmount, subtotal) },
    { type: 'early_bird', discount: pctOf(subtotal, earlyBirdPct) },
    { type: 'group', discount: groupEligible ? pctOf(subtotal, groupPct) : 0 },
  ];

  let best = { type: 'none', discount: 0 };
  for (const c of candidates) {
    if (c.discount > best.discount) best = c;
  }

  const discountOf = (type) => (best.type === type ? best.discount : 0);

  return {
    subtotal,
    applied: best.type, // 'promo' | 'early_bird' | 'group' | 'none'
    early_bird_discount: discountOf('early_bird'),
    group_discount: discountOf('group'),
    group_applied: best.type === 'group',
    promo_discount: discountOf('promo'),
    discount_total: best.discount,
    total: subtotal - best.discount,
  };
}
