import { api } from '../api.js'
import { countdown, mmss } from '../lib/countdown.js'
import { formatCents } from '../lib/money.js'
import { esc, errorBox } from './ui.js'

const APPLIED = { promo: '優惠碼', early_bird: '早鳥', group: '團體' }

// 保留:倒數以伺服器時間為準。金額由 POST /holds/:id/quote 試算(跟確認同一套算法),
// 優惠碼按「套用」當場顯示結果;確認時只在試算結果是「已套用」才把碼送出去。
export async function holdPage(el, id) {
  let ev
  try { ev = await api('GET', `/events/${encodeURIComponent(id)}`) } catch (e) { el.innerHTML = errorBox(e); return }
  const hold = ev.my_hold
  if (!hold) { location.hash = `#/events/${id}`; return }
  el.innerHTML = `
    <div class="card bg-base-100 shadow"><div class="card-body">
      <h2 class="card-title">${esc(ev.name)}:保留 ${hold.seat_nos.map(esc).join('、')}</h2>
      <div class="text-4xl font-mono text-center my-2" id="left">--:--</div>
      <div id="price" class="bg-base-200 rounded-box p-3 text-sm"></div>
      <div class="join w-full mt-2">
        <input id="promo" maxlength="32" placeholder="優惠碼(可不填)" class="input join-item w-full" />
        <button id="apply" class="btn join-item">套用</button>
      </div>
      <div id="promo-msg" class="text-sm mt-1"></div>
      <div class="flex gap-2 mt-2">
        <button id="ok" class="btn btn-primary flex-1">確認</button>
        <button id="drop" class="btn flex-1">放棄</button>
      </div>
      <div id="err"></div>
    </div></div>`
  const $ = (s) => el.querySelector(s)
  let appliedCode = null

  function showPrice(q) {
    const discount = q.subtotal_cents - q.total_cents
    $('#price').innerHTML = `
      <div class="flex justify-between"><span>原價(${hold.seat_nos.length} 席)</span><span>${formatCents(q.subtotal_cents)}</span></div>
      <div class="flex justify-between"><span>折扣${q.applied ? `(${APPLIED[q.applied]}${q.applied === 'promo' ? '' : ` ${q.early_bird_pct || q.group_pct}%`})` : ''}</span>
        <span>${discount ? `−${formatCents(discount)}` : '—'}</span></div>
      <div class="flex justify-between font-bold text-base mt-1"><span>應付</span><span>${formatCents(q.total_cents)}</span></div>
      <div class="opacity-60 text-xs mt-1">折扣不疊加,自動套用最划算的一種</div>`
  }

  async function quote(code) {
    const q = await api('POST', `/holds/${encodeURIComponent(hold.id)}/quote`, code ? { promo_code: code } : {})
    showPrice(q)
    return q
  }

  try { await quote() } catch (e) { $('#err').innerHTML = errorBox(e) }

  $('#apply').addEventListener('click', async () => {
    const code = $('#promo').value.trim()
    const msg = $('#promo-msg')
    appliedCode = null
    if (!code) { msg.textContent = ''; await quote(); return }
    try {
      const q = await quote(code)
      if (q.promo_status === 'applied') {
        appliedCode = code
        msg.className = 'text-sm mt-1 text-success'
        msg.textContent = `已套用 ${code.toUpperCase()}:折 ${formatCents(q.promo_cents)}`
      } else if (q.promo_status === 'not_better') {
        msg.className = 'text-sm mt-1 text-info'
        msg.textContent = `${code.toUpperCase()} 可以用,但目前的${APPLIED[q.applied]}折扣更划算,這次不會用掉這個碼`
      } else {
        msg.className = 'text-sm mt-1 text-error'
        msg.textContent = q.applied
          ? `優惠碼無法使用(不存在、過期或已用過);已套用${APPLIED[q.applied]}折扣`
          : '優惠碼無法使用(不存在、過期或已用過)'
      }
    } catch (e) { msg.className = 'text-sm mt-1 text-error'; msg.innerHTML = errorBox(e) }
  })
  $('#promo').addEventListener('input', () => { appliedCode = null; $('#promo-msg').textContent = '' })

  const stop = countdown(hold.expires_at, (ms) => { $('#left').textContent = mmss(ms) }, () => {
    $('#left').textContent = '已過期'
    setTimeout(() => { location.hash = `#/events/${id}` }, 1500)
  })
  $('#ok').addEventListener('click', async () => {
    try {
      await api('POST', `/holds/${encodeURIComponent(hold.id)}/confirm`, appliedCode ? { promo_code: appliedCode } : {})
      location.hash = '#/tickets'
    } catch (e) { $('#err').innerHTML = errorBox(e) }
  })
  $('#drop').addEventListener('click', async () => {
    try { await api('DELETE', `/holds/${encodeURIComponent(hold.id)}`); location.hash = `#/events/${id}` }
    catch (e) { $('#err').innerHTML = errorBox(e) }
  })
  return stop
}
