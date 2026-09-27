// 身分與權限的 middleware。
import { verify } from '../lib/jwt.js'

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
