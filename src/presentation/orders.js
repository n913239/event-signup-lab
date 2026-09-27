// 組契約的 Order。qr_payload 在這一層算,不查 DB(SC-008)。
import { qrPayload } from '../lib/hmac.js'

export async function order(o, qrSecret) {
  return {
    id: o.id, event_id: o.event_id, event_name: o.event_name, member_id: o.member_id, status: o.status, items: o.items,
    subtotal_cents: o.subtotal_cents, early_bird_pct: o.early_bird_pct, group_pct: o.group_pct,
    promo_code: o.promo_code, promo_cents: o.promo_cents, total_cents: o.total_cents, confirmed_at: o.confirmed_at,
    qr_payload: await qrPayload(o.id, qrSecret),
  }
}
