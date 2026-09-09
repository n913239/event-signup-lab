// 拿「我的尺」去量 AI 的實作。
// 不變條件只有一條:每個人應付的加起來,必須剛好等於總額。
// 這條不成立,帳就對不起來 —— 不管它的程式碼看起來多漂亮。
const path = require('path')
const mod = require(path.join(__dirname, 'settle.js'))
const settle = mod.settleGroupOrder || mod

let fail = 0, cases = 0, worst = null
const people = ['a','b','c','d','e','f','g']

// 決定性偽亂數,方便重現
let seed = 42
const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n }

for (let t = 0; t < 20000; t++) {
  const n = 1 + rnd(6)
  const orders = []
  for (let i = 0; i < n; i++) {
    orders.push({ person: people[i], unitPrice: 1 + rnd(200), quantity: 1 + rnd(3) })
  }
  const opts = {
    deliveryFee: rnd(300),
    freeShippingThreshold: rnd(4) === 0 ? rnd(1000) : Infinity,
  }
  let r
  try { r = settle(orders, opts) } catch (e) { fail++; continue }
  cases++
  const sum = Object.values(r.perPerson).reduce((a, b) => a + b, 0)
  // 用分比較,避開浮點顯示誤差
  const dsum = Math.round(sum * 100), dtot = Math.round(r.total * 100)
  if (dsum !== dtot) {
    fail++
    if (!worst) worst = { orders, opts, sum, total: r.total, perPerson: r.perPerson }
  }
}

console.log(`測試案例      : ${cases}`)
console.log(`不變條件違反  : ${fail}`)
if (worst) {
  console.log('\n第一個反例:')
  console.log(JSON.stringify(worst, null, 2).slice(0, 600))
} else {
  console.log('✅ 20,000 個隨機案例,分攤總和永遠等於總額')
}

// 邊界:單人、零運費、剛好達門檻、差一元
const edge = [
  ['單人', [{person:'a',unitPrice:100,quantity:1}], {deliveryFee:100}],
  ['三人分 100 運費', [1,2,3].map(i=>({person:people[i],unitPrice:65,quantity:1})), {deliveryFee:100}],
  ['七人分 1 元', people.map(p=>({person:p,unitPrice:50,quantity:1})), {deliveryFee:1}],
  ['剛好達門檻', [{person:'a',unitPrice:500,quantity:1}], {deliveryFee:100,freeShippingThreshold:500}],
  ['差一元沒達標', [{person:'a',unitPrice:499,quantity:1}], {deliveryFee:100,freeShippingThreshold:500}],
]
console.log('\n邊界案例:')
for (const [name, orders, opts] of edge) {
  const r = settle(orders, opts)
  const sum = Object.values(r.perPerson).reduce((a,b)=>a+b,0)
  const ok = Math.round(sum*100) === Math.round(r.total*100)
  console.log(`  ${ok?'✅':'❌'} ${name.padEnd(16)} total=${r.total} 運費=${r.deliveryFee} 分攤=${JSON.stringify(r.perPerson)}`)
}
