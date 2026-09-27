import { api } from '../api.js'
import { esc, errorBox, fmtTime } from './ui.js'

export async function eventsPage(el) {
  const onlyOnSale = new URLSearchParams(location.search).get('all') === null
  el.innerHTML = `<div class="flex items-center gap-2 mb-4">
      <h2 class="text-xl font-bold flex-1">活動</h2>
      <label class="label"><input id="all" type="checkbox" class="toggle toggle-sm" ${onlyOnSale ? '' : 'checked'} /> 全部狀態</label>
    </div><div id="list">載入中…</div>`
  el.querySelector('#all').addEventListener('change', (e) => { load(!e.target.checked) })
  async function load(onSale) {
    try {
      const { events } = await api('GET', onSale ? '/events?status=on_sale' : '/events')
      el.querySelector('#list').innerHTML = events.length ? events.map((e) => `
        <a href="#/events/${esc(e.id)}" class="card bg-base-100 shadow mb-3 hover:shadow-md"><div class="card-body">
          <h3 class="card-title">${esc(e.name)} <span class="badge">${esc(e.status)}</span></h3>
          <p class="text-sm">開賣 ${fmtTime(e.opens_at)}・截止 ${fmtTime(e.deadline_at)}・剩 ${e.remaining_seats} 席</p>
        </div></a>`).join('') : '<p>沒有活動</p>'
    } catch (e) { el.querySelector('#list').innerHTML = errorBox(e) }
  }
  await load(onlyOnSale)
}
