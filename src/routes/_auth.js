// 身分與權限的 middleware。
import { verify } from '../lib/jwt.js'
import { findById as findEvent } from '../lib/db/events.js'

const unauthorized = (c) => c.json({ error: 'unauthorized', server_now: c.get('now') }, 401)

export async function requireMember(c, next) {
  const m = /^Bearer (\S+)$/.exec(c.req.header('authorization') ?? '')
  const claims = m && c.env?.JWT_SECRET ? await verify(m[1], c.env.JWT_SECRET, c.get('now')) : null
  if (!claims) return unauthorized(c)
  c.set('member', { id: claims.sub, role: claims.role })
  await next()
}

export async function requireStaff(c, next) {
  if (c.get('member')?.role !== 'staff') return c.json({ error: 'forbidden', server_now: c.get('now') }, 403)
  await next()
}

// 僅主辦:活動不存在 → 404;不是建立者 → 403。通過時 c.set('event', …)。
// 路由參數叫 :id(活動)。票種的路由先查出 event_id 再呼叫 ownerCheck。
export async function requireOwner(c, next) {
  const e = await findEvent(c.env.DB, c.req.param('id'), c.get('now'))
  const denied = ownerCheck(c, e)
  if (denied) return denied
  c.set('event', e)
  await next()
}

export function ownerCheck(c, e) {
  if (!e) return c.json({ error: 'not_found', server_now: c.get('now') }, 404)
  if (e.owner_id !== c.get('member').id) return c.json({ error: 'forbidden', server_now: c.get('now') }, 403)
  return null
}
