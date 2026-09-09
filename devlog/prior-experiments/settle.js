'use strict';

/**
 * 揪團訂飲料結算。
 *
 * @param {Array<{person: string, item?: string, unitPrice: number, quantity: number}>} orders
 * @param {Object} [options]
 * @param {number} [options.deliveryFee=0]                   外送費(整團一筆)
 * @param {number} [options.freeShippingThreshold=Infinity]  飲料小計達此金額即免運(>=)
 * @param {number} [options.feeSplitUnit=1]                  運費均分的最小單位,1 = 分到整數元
 * @returns {{
 *   total: number, subtotal: number, deliveryFee: number, freeShipping: boolean,
 *   perPerson: Object<string, number>,
 *   breakdown: Array<{person: string, drinks: number, shippingShare: number, due: number}>
 * }}
 */
function settleGroupOrder(orders, options = {}) {
  const {
    deliveryFee = 0,
    freeShippingThreshold = Infinity,
    feeSplitUnit = 1,
  } = options;

  if (!Array.isArray(orders)) throw new TypeError('orders 必須是陣列');
  if (!isFiniteNumber(deliveryFee) || deliveryFee < 0) {
    throw new RangeError('deliveryFee 必須是 >= 0 的數字');
  }
  if (freeShippingThreshold !== Infinity &&
      (!isFiniteNumber(freeShippingThreshold) || freeShippingThreshold < 0)) {
    throw new RangeError('freeShippingThreshold 必須是 >= 0 的數字或 Infinity');
  }
  if (!isFiniteNumber(feeSplitUnit) || feeSplitUnit <= 0) {
    throw new RangeError('feeSplitUnit 必須是 > 0 的數字');
  }

  // 一律換算成「分」(整數)運算,避開 0.1 + 0.2 !== 0.3 這類浮點誤差。
  const drinksCents = new Map(); // person -> cents,保留首次出現的順序

  orders.forEach((order, i) => {
    const { person, unitPrice, quantity } = order || {};
    const name = typeof person === 'string' ? person.trim() : '';
    if (!name) throw new TypeError(`orders[${i}].person 必須是非空字串`);
    if (!isFiniteNumber(unitPrice) || unitPrice < 0) {
      throw new RangeError(`orders[${i}].unitPrice 必須是 >= 0 的數字`);
    }
    if (!Number.isInteger(quantity) || quantity < 0) {
      throw new RangeError(`orders[${i}].quantity 必須是 >= 0 的整數`);
    }
    drinksCents.set(name, (drinksCents.get(name) || 0) + toCents(unitPrice) * quantity);
  });

  const subtotalCents = [...drinksCents.values()].reduce((a, b) => a + b, 0);
  const freeShipping = subtotalCents >= toCents(freeShippingThreshold);

  // 只有「真的有訂到東西」(小計 > 0)的人分攤運費。
  const payers = new Set(
    [...drinksCents.keys()].filter((p) => drinksCents.get(p) > 0)
  );
  const n = payers.size;
  const feeCents = freeShipping || n === 0 ? 0 : toCents(deliveryFee);

  // 均分:先給每人整數個 unit,除不盡的餘額依序一個 unit 一個 unit 補給前面的人。
  // 這樣保證 sum(每人應付) === total,不會因四捨五入而少收或多收。
  const unit = Math.max(1, toCents(feeSplitUnit));
  const base = n ? Math.floor(feeCents / n / unit) * unit : 0;
  let rest = feeCents - base * n;

  const perPerson = {};
  const breakdown = [];
  for (const [person, drinks] of drinksCents) {
    let shippingShare = 0;
    if (payers.has(person)) {
      const extra = Math.min(unit, rest);
      shippingShare = base + extra;
      rest -= extra;
    }
    const due = drinks + shippingShare;
    perPerson[person] = fromCents(due);
    breakdown.push({
      person,
      drinks: fromCents(drinks),
      shippingShare: fromCents(shippingShare),
      due: fromCents(due),
    });
  }

  return {
    total: fromCents(subtotalCents + feeCents),
    subtotal: fromCents(subtotalCents),
    deliveryFee: fromCents(feeCents),
    freeShipping,
    perPerson,
    breakdown,
  };
}

function isFiniteNumber(n) {
  return typeof n === 'number' && Number.isFinite(n);
}
function toCents(n) {
  return n === Infinity ? Infinity : Math.round(n * 100);
}
function fromCents(cents) {
  return Math.round(cents) / 100;
}

module.exports = { settleGroupOrder };

// ------------------------------------------------------------- 範例與自我驗證
if (require.main === module) {
  const orders = [
    { person: '小明', item: '珍珠奶茶 大', unitPrice: 65, quantity: 2 },
    { person: '小華', item: '四季春 中',   unitPrice: 40, quantity: 1 },
    { person: '小華', item: '檸檬紅茶 大', unitPrice: 55, quantity: 1 },
    { person: '阿美', item: '冬瓜檸檬 大', unitPrice: 60, quantity: 1 },
  ];

  const a = settleGroupOrder(orders, { deliveryFee: 100, freeShippingThreshold: 500 });
  console.log('# 未達免運(小計 285 < 500)');
  console.log(JSON.stringify(a, null, 2));

  const b = settleGroupOrder(orders, { deliveryFee: 100, freeShippingThreshold: 280 });
  console.log('# 已達免運(小計 285 >= 280)');
  console.log(JSON.stringify(b.perPerson), 'total =', b.total, 'freeShipping =', b.freeShipping);

  console.log('# 加總必須等於 total');
  const sum = Object.values(a.perPerson).reduce((x, y) => x + y, 0);
  console.log(sum, '===', a.total, '->', Math.round(sum * 100) === Math.round(a.total * 100));

  console.log('# 空團');
  console.log(JSON.stringify(settleGroupOrder([], { deliveryFee: 100 })));

  console.log('# 掛名但沒訂(quantity 0)不分攤運費');
  console.log(JSON.stringify(settleGroupOrder([
    { person: 'A', item: '紅茶', unitPrice: 30, quantity: 1 },
    { person: 'B', item: '綠茶', unitPrice: 30, quantity: 0 },
  ], { deliveryFee: 60, freeShippingThreshold: 500 }).perPerson));

  console.log('# 分到「分」:feeSplitUnit = 0.01');
  console.log(JSON.stringify(settleGroupOrder(orders, {
    deliveryFee: 100, freeShippingThreshold: 500, feeSplitUnit: 0.01,
  }).perPerson));

  console.log('# 浮點:0.1 x 3');
  console.log(settleGroupOrder([{ person: 'A', item: 'x', unitPrice: 0.1, quantity: 3 }]).total);
}
