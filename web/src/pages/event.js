import { api } from '../api.js'
import { formatCents } from '../lib/money.js'
import { esc, errorBox, fmtTime } from './ui.js'

const ROWS = 'ABCDEFGHIJ'
const COLOR = { free: 'btn-outline', held: 'btn-warning btn-disabled', sold: 'btn-neutral btn-disabled', mine: 'btn-success' }

// 活動頁:10×10 選位(free / held / sold / mine 四色)、票種選單、多選 → 保留。全有全無由後端決定。
export async function eventPage(el, id) {
  let ev
  try { ev = await api('GET', `/events/${encodeURIComponent(id)}`) } catch (e) { el.innerHTML = errorBox(e); return }
  if (ev.my_hold) { location.hash = `#/events/${id}/hold`; return }
  const state = Object.fromEntries(ev.seats.map((s) => [s.seat_no, s.state]))
  const picked = new Set()
  el.innerHTML = `
    <h2 class="text-xl font-bold">${esc(ev.name)} <span class="badge">${esc(ev.status)}</span></h2>
    <p class="text-sm mb-3">截止 ${fmtTime(ev.deadline_at)}・保留 ${ev.hold_ttl_minutes} 分鐘・${ev.group_min_qty} 席以上團體 ${ev.group_pct}% off</p>
    <select id="tt" class="select w-full mb-3">${ev.ticket_types.map((t) => `
      <option value="${esc(t.id)}" ${t.remaining ? '' : 'disabled'}>${esc(t.name)}・${formatCents(t.price_cents)}・剩 ${t.remaining}${t.early_bird_until ? `・早鳥 ${t.early_bird_pct}% 到 ${fmtTime(t.early_bird_until)}` : ''}</option>`).join('')}
    </select>
    <div class="text-center text-xs opacity-60 mb-1">舞台</div>
    <div class="grid grid-cols-10 gap-1 mb-3">${[...ROWS].flatMap((r) => Array.from({ length: 10 }, (_, i) => `${r}${i + 1}`)).map((no) => `
      <button data-seat="${no}" class="btn btn-xs ${COLOR[state[no] ?? 'free']}">${no}</button>`).join('')}
    </div>
    <button id="hold" class="btn btn-primary w-full" disabled>保留 0 席</button>
    <div id="err"></div>`
  const btn = el.querySelector('#hold')
  el.querySelectorAll('[data-seat]').forEach((b) => b.addEventListener('click', () => {
    const no = b.dataset.seat
    if (state[no] !== 'free' && state[no] !== undefined) return
    picked.has(no) ? picked.delete(no) : picked.add(no)
    b.classList.toggle('btn-primary', picked.has(no)); b.classList.toggle('btn-outline', !picked.has(no))
    btn.disabled = picked.size === 0; btn.textContent = `保留 ${picked.size} 席`
  }))
  btn.addEventListener('click', async () => {
    try {
      await api('POST', `/events/${encodeURIComponent(id)}/holds`, { ticket_type_id: el.querySelector('#tt').value, seat_nos: [...picked] })
      location.hash = `#/events/${id}/hold`
    } catch (e) { el.querySelector('#err').innerHTML = errorBox(e) }
  })
}
