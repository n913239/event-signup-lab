// 活動報名訂單金額計算
//
// 計算順序(每一步都以前一步的結果為基準):
//   1. 小計       = unit_price × qty
//   2. 早鳥折扣   = 小計 × early_bird_pct%
//   3. 團體折扣   = (小計 − 早鳥折扣) × group_pct%     ← qty ≥ group_min_qty 才適用
//   4. 優惠碼折抵 = min(promo_amount, 剩餘金額)         ← 應付金額不會變成負數
//
// 金額以整數元計算,每一筆折扣各自四捨五入到整數元,
// 所以 subtotal − 各項折扣 === total 一定成立,不會有對不上的零頭。

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

  const earlyBirdDiscount = pctOf(subtotal, earlyBirdPct);
  let remaining = subtotal - earlyBirdDiscount;

  const groupApplied = groupMinQty > 0 && groupPct > 0 && qty >= groupMinQty;
  const groupDiscount = groupApplied ? pctOf(remaining, groupPct) : 0;
  remaining -= groupDiscount;

  const promoDiscount = Math.min(promoAmount, remaining);
  remaining -= promoDiscount;

  return {
    subtotal,
    early_bird_discount: earlyBirdDiscount,
    group_discount: groupDiscount,
    group_applied: groupApplied,
    promo_discount: promoDiscount,
    discount_total: earlyBirdDiscount + groupDiscount + promoDiscount,
    total: remaining,
  };
}
