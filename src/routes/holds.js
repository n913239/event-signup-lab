import { Hono } from 'hono'
import { requireMember } from './_auth.js'
import * as validate from '../domain/validate.js'
import { isHoldExpired, isEarlyBird } from '../domain/time-rules.js'
import { quote } from '../domain/money.js'
import * as holdsDb from '../lib/db/holds.js'
import * as orders from '../lib/db/orders.js'
import * as ticketTypes from '../lib/db/ticket-types.js'
import * as events from '../lib/db/events.js'
import * as promos from '../lib/db/promo-codes.js'
import * as present from '../presentation/orders.js'

export const holds = new Hono()

holds.use('*', requireMember)

const err = (c, status, error) => c.json({ error, server_now: c.get('now') }, status)

// 僅本人:主動放棄。不是本人的 = 不存在(404,避免枚舉)。
holds.delete('/:id', async (c) => {
  const me = c.get('member').id
  const h = await holdsDb.findHold(c.env.DB, c.req.param('id'), me)
  if (!h) return err(c, 404, 'not_found')
  if (await holdsDb.releaseHold(c.env.DB, { holdId: h.id, memberId: me }, c.get('now')) === 0) return err(c, 409, 'terminal_state')
  return c.body(null, 204)
})

// 僅本人:確認 → 建訂單 + 寫價格快照。
// 只查 hold 自己的 expires_at,不查活動狀態(C13:截止前建立的 hold 截止後仍可確認)。
holds.post('/:id/confirm', async (c) => {
  const now = c.get('now')
  const me = c.get('member').id
  let b = {}
  try { b = (await c.req.json()) ?? {} } catch { /* body 可省略 */ }
  const h = await holdsDb.findHold(c.env.DB, c.req.param('id'), me)
  if (!h) return err(c, 404, 'not_found')
  if (h.status === 'confirmed') {                                        // H7:重複確認回同一張訂單
    const o = await orders.findByHold(c.env.DB, h.id)
    return c.json(await present.order(o, c.env.QR_SECRET), 200)
  }
  if (h.status === 'expired' || (h.status === 'holding' && isHoldExpired(h, now))) return err(c, 409, 'hold_expired')
  if (h.status !== 'holding') return err(c, 409, 'terminal_state')

  const p = await price(c, h, b.promo_code)
  if (p.error) return err(c, p.status, p.error)
  if (p.promoStatus === 'invalid' && p.blocks) return err(c, 409, 'promo_rejected')
  const { q, promo, tt } = p

  const orderId = crypto.randomUUID()
  try {
    const ok = await orders.insertConfirmed(c.env.DB, {
      orderId, hold: h, memberId: me, unitPriceCents: tt.price_cents, quote: q,
      promoCode: q.applied === 'promo' ? promo.code : null,                  // 沒被選中的碼不記、不算用掉
    }, now)
    if (!ok) {
      // 輸了:可能是別的 confirm 先成立(H7 → 回同一張訂單),或跟 sweep / 搶位同時到期
      const again = await holdsDb.findHold(c.env.DB, h.id, me)
      const existing = again?.status === 'confirmed' ? await orders.findByHold(c.env.DB, h.id) : null
      if (existing) return c.json(await present.order(existing, c.env.QR_SECRET), 200)
      return err(c, 409, 'hold_expired')
    }
  } catch (e) {
    if (/UNIQUE.*orders\.member_id/.test(e.message)) return err(c, 409, 'promo_rejected')
    throw e
  }
  return c.json(await present.order(await orders.findById(c.env.DB, orderId), c.env.QR_SECRET), 201)
})

// 試算與確認共用:回 { q, promo, promoStatus, blocks, tt }。
// promoStatus:none(沒帶碼)/ applied(套用)/ not_better(有效但別的折扣更好或一樣好)/ invalid(無效)。
// blocks:無效的碼「本來會嚴格更便宜」或「沒有別的折扣」→ 確認時要 409(C8 改定)。
async function price(c, h, promoInput) {
  const now = c.get('now')
  const me = c.get('member').id
  const [tt, ev] = await Promise.all([ticketTypes.findById(c.env.DB, h.ticket_type_id), events.findById(c.env.DB, h.event_id, now)])
  const base = {
    unit_price_cents: tt.price_cents,                                    // C10:確認當下的票價
    qty: h.seat_nos.length,
    early_bird_pct: isEarlyBird(tt, h.created_at) ? tt.early_bird_pct : 0,   // M1:早鳥看建立保留的時間
    group_min_qty: ev.group_min_qty, group_pct: ev.group_pct,
    promo_cents: 0,
  }
  const q0 = quote(base)
  if (promoInput === undefined || promoInput === '') return { q: q0, promo: null, promoStatus: 'none', tt }
  const v = validate.promoCode(promoInput)
  if (!v.ok) return { error: v.error, status: 400 }
  const promo = await promos.findByCode(c.env.DB, v.value)
  const valid = promo && now < promo.valid_until && (promo.event_id == null || promo.event_id === h.event_id)   // M4:看確認時間
    && !(await promos.usedBy(c.env.DB, { memberId: me, eventId: h.event_id, code: promo.code }))
  if (valid) {
    const q = quote({ ...base, promo_cents: promo.discount_cents })
    return { q, promo, promoStatus: q.applied === 'promo' ? 'applied' : 'not_better', tt }
  }
  const blocks = promo ? quote({ ...base, promo_cents: promo.discount_cents }).total_cents < q0.total_cents : q0.applied === null
  return { q: q0, promo: null, promoStatus: 'invalid', blocks, tt }
}

// 試算:不建訂單、不用掉碼。給「套用」按鈕用。
holds.post('/:id/quote', async (c) => {
  const now = c.get('now')
  let b = {}
  try { b = (await c.req.json()) ?? {} } catch { /* body 可省略 */ }
  const h = await holdsDb.findHold(c.env.DB, c.req.param('id'), c.get('member').id)
  if (!h) return err(c, 404, 'not_found')
  if (h.status === 'expired' || (h.status === 'holding' && isHoldExpired(h, now))) return err(c, 409, 'hold_expired')
  if (h.status !== 'holding') return err(c, 409, 'terminal_state')
  const p = await price(c, h, b.promo_code)
  if (p.error) return err(c, p.status, p.error)
  return c.json({ ...p.q, promo_status: p.promoStatus, server_now: now })
})
