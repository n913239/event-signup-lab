import QRCode from 'qrcode'
import { api } from '../api.js'
import { formatCents } from '../lib/money.js'
import { esc, errorBox, fmtTime } from './ui.js'

// 我的票券:列表 + 明細(金額快照、QR)。金額一律經 lib/money.js。
// 折扣不疊加、擇優:一張訂單只會有一種折扣,只顯示實際套用的那一種。
const discountText = (o) =>
  o.promo_code ? `優惠碼 ${esc(o.promo_code)} −${formatCents(o.promo_cents)}`
  : o.early_bird_pct ? `早鳥 ${o.early_bird_pct}% off`
  : o.group_pct ? `團體 ${o.group_pct}% off`
  : '無折扣'
export async function ticketsPage(el) {
  let orders
  try { ({ orders } = await api('GET', '/orders')) } catch (e) { el.innerHTML = errorBox(e); return }
  const flash = sessionStorage.getItem('flash'); sessionStorage.removeItem('flash')
  el.innerHTML = `<h2 class="text-xl font-bold mb-4">我的票券</h2>` + (flash ? `<div role="alert" class="alert alert-info mb-3">${esc(flash)}</div>` : '') + (orders.length ? orders.map((o) => `
    <div class="card bg-base-100 shadow mb-3"><div class="card-body">
      <h3 class="card-title">${esc(o.event_name)} <span class="badge">${esc(o.status)}</span></h3>
      <p class="text-sm">${o.items.map((i) => `${esc(i.seat_no)} ${esc(i.ticket_type_name)} ${formatCents(i.unit_price_cents)}`).join('、')}</p>
      <p class="text-sm">小計 ${formatCents(o.subtotal_cents)}・${discountText(o)}</p>
      <p class="font-bold">總計 ${formatCents(o.total_cents)}・確認於 ${fmtTime(o.confirmed_at)}</p>
      ${o.qr_payload ? `<canvas data-qr="${esc(o.qr_payload)}"></canvas>` : ''}
      ${o.status === 'confirmed' ? `<button data-cancel="${esc(o.id)}" class="btn btn-sm btn-error btn-outline w-fit">取消訂單</button>` : ''}
      <div data-err="${esc(o.id)}"></div>
    </div></div>`).join('') : '<p>還沒有票券</p>')
  el.querySelectorAll('[data-qr]').forEach((c) => QRCode.toCanvas(c, c.dataset.qr, { width: 160 }))
  el.querySelectorAll('[data-cancel]').forEach((b) => b.addEventListener('click', async () => {
    try { await api('POST', `/orders/${encodeURIComponent(b.dataset.cancel)}/cancel`); ticketsPage(el) }
    catch (e) { el.querySelector(`[data-err="${b.dataset.cancel}"]`).innerHTML = errorBox(e) }
  }))
}
