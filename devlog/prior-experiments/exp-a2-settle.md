# 揪團訂飲料結算函式 (JavaScript)

單檔、零相依,Node 直接跑得動 (`node settle.js`),也可 `require` 使用。

## 用法

```js
const { settleGroupOrder } = require('./settle');

const result = settleGroupOrder(
  [
    { person: '小明', item: '珍珠奶茶 大', unitPrice: 65, quantity: 2 },
    { person: '小華', item: '四季春 中',   unitPrice: 40, quantity: 1 },
    { person: '小華', item: '檸檬紅茶 大', unitPrice: 55, quantity: 1 },
    { person: '阿美', item: '冬瓜檸檬 大', unitPrice: 60, quantity: 1 },
  ],
  { deliveryFee: 100, freeShippingThreshold: 500 }
);

result.total;      // 385
result.perPerson;  // { 小明: 164, 小華: 128, 阿美: 93 }
```

回傳值:

| 欄位 | 說明 |
|---|---|
| `total` | 全團總金額 (飲料小計 + 實收運費) |
| `subtotal` | 飲料小計 (不含運費) |
| `deliveryFee` | 實際收取的運費 (免運時為 0) |
| `freeShipping` | 是否達到免運 |
| `perPerson` | `{ 姓名: 應付金額 }` |
| `breakdown` | 每人的飲料金額 / 運費分攤 / 應付,方便直接貼到群組 |

## 程式碼

```js
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
```

(完整檔含範例與自我驗證:`settle.js`)

## 幾個有意見的設計決定

1. **免運判斷用飲料小計,不含運費本身** — 否則會出現「因為加了運費才達標、達標後又免運」的循環。門檻採 `>=` (剛好等於門檻就免運)。
2. **只有真的訂到東西的人分攤運費** — 判斷條件是該人小計 `> 0`。所以填了單但 `quantity: 0` 的人 (掛名、後來取消) 不會被算進分母,也不會平白被收運費。
3. **除不盡的餘額有人吸收,不會憑空消失** — 運費 100 三個人分,不是每人 33 讓帳短少 1 元,而是 `34 / 33 / 33`。作法是先每人整數個單位,餘額再依序一單位一單位補給前面的人 (順序 = 訂單裡首次出現的順序)。**保證 `sum(perPerson) === total`**,程式裡有這條斷言。
4. **分攤單位預設是「元」** — `feeSplitUnit` 預設 `1`,因為飲料團收現金不會找到角。要分到小數點兩位就傳 `feeSplitUnit: 0.01`,結果會是 `33.34 / 33.33 / 33.33`。
5. **金額一律換算成「分」的整數再運算** — 避開 `0.1 + 0.2 !== 0.3`。`0.1 元 x 3` 回傳的是 `0.3` 而不是 `0.30000000000000004`。
6. **同一人多筆訂單自動合併**,key 是 `person.trim()`。注意這代表**同名同姓會被合成一個人**;如果團裡有兩個「小明」,請在資料源就給不同的識別字串 (例如 `小明(業務)`)。
7. **輸入驗證從嚴** — `person` 空字串、`unitPrice` 為負或 NaN、`quantity` 非整數都直接 throw,而不是默默算出一個錯的帳。

## 邊界情況 (皆為實測輸出)

| 情況 | 結果 |
|---|---|
| 空團 `[]` | `total: 0`,`perPerson: {}`,不收運費 |
| 全團只有掛名者 (小計 0) | 分母為 0,運費不收 (沒人該付) |
| 小計剛好等於門檻 | 免運 (`>=`) |
| 運費除不盡 | 餘數給前面的人,加總仍等於 `total` |

## 實測輸出

```
# 未達免運(小計 285 < 500)
{
  "total": 385,
  "subtotal": 285,
  "deliveryFee": 100,
  "freeShipping": false,
  "perPerson": {
    "小明": 164,
    "小華": 128,
    "阿美": 93
  },
  "breakdown": [
    {
      "person": "小明",
      "drinks": 130,
      "shippingShare": 34,
      "due": 164
    },
    {
      "person": "小華",
      "drinks": 95,
      "shippingShare": 33,
      "due": 128
    },
    {
      "person": "阿美",
      "drinks": 60,
      "shippingShare": 33,
      "due": 93
    }
  ]
}
# 已達免運(小計 285 >= 280)
{"小明":130,"小華":95,"阿美":60} total = 285 freeShipping = true
# 加總必須等於 total
385 === 385 -> true
# 空團
{"total":0,"subtotal":0,"deliveryFee":0,"freeShipping":false,"perPerson":{},"breakdown":[]}
# 掛名但沒訂(quantity 0)不分攤運費
{"A":90,"B":0}
# 分到「分」:feeSplitUnit = 0.01
{"小明":163.34,"小華":128.33,"阿美":93.33}
# 浮點:0.1 x 3
0.3
```
