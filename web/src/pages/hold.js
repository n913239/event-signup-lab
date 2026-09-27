import { api } from '../api.js'
import { countdown, mmss } from '../lib/countdown.js'
import { esc, errorBox } from './ui.js'

// 保留:倒數以伺服器時間為準;可輸入優惠碼後確認,或主動放棄。歸零顯示已過期並回活動頁。
export async function holdPage(el, id) {
  let ev
  try { ev = await api('GET', `/events/${encodeURIComponent(id)}`) } catch (e) { el.innerHTML = errorBox(e); return }
  const hold = ev.my_hold
  if (!hold) { location.hash = `#/events/${id}`; return }
  el.innerHTML = `
    <div class="card bg-base-100 shadow"><div class="card-body">
      <h2 class="card-title">${esc(ev.name)}:保留 ${hold.seat_nos.map(esc).join('、')}</h2>
      <div class="text-4xl font-mono text-center my-2" id="left">--:--</div>
      <input id="promo" maxlength="32" placeholder="優惠碼(可不填)" class="input w-full" />
      <div class="flex gap-2 mt-2">
        <button id="ok" class="btn btn-primary flex-1">確認</button>
        <button id="drop" class="btn flex-1">放棄</button>
      </div>
      <div id="err"></div>
    </div></div>`
  const stop = countdown(hold.expires_at, (ms) => { el.querySelector('#left').textContent = mmss(ms) }, () => {
    el.querySelector('#left').textContent = '已過期'
    setTimeout(() => { location.hash = `#/events/${id}` }, 1500)
  })
  el.querySelector('#ok').addEventListener('click', async () => {
    const promo = el.querySelector('#promo').value.trim()
    try {
      const order = await api('POST', `/holds/${encodeURIComponent(hold.id)}/confirm`, promo ? { promo_code: promo } : {})
      // 折扣不疊加、擇優:輸入了碼卻沒被選中時告訴使用者,碼沒有用掉
      if (promo && !order.promo_code) sessionStorage.setItem('flash', '優惠碼未套用:已有更優惠的折扣,這個碼沒有用掉')
      location.hash = '#/tickets'
    } catch (e) { el.querySelector('#err').innerHTML = errorBox(e) }
  })
  el.querySelector('#drop').addEventListener('click', async () => {
    try { await api('DELETE', `/holds/${encodeURIComponent(hold.id)}`); location.hash = `#/events/${id}` }
    catch (e) { el.querySelector('#err').innerHTML = errorBox(e) }
  })
  return stop
}
