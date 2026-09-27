import { Hono } from 'hono'
import * as validate from '../domain/validate.js'
import { hash, verify as verifyPassword } from '../lib/password.js'
import { sign, newRefreshToken, sha256Hex, ACCESS_TTL_MS } from '../lib/jwt.js'
import * as members from '../lib/db/members.js'
import * as refreshTokens from '../lib/db/refresh-tokens.js'
import { requireMember } from './_auth.js'

export const auth = new Hono()

const err = (c, status, error) => c.json({ error, server_now: c.get('now') }, status)
const body = async (c) => { try { return await c.req.json() } catch { return null } }

async function issue(c, member) {
  const now = c.get('now')
  const refresh = newRefreshToken()
  await refreshTokens.insert(c.env.DB, { tokenHash: await sha256Hex(refresh), memberId: member.id }, now)
  return {
    access_token: await sign({ sub: member.id, role: member.role }, c.env.JWT_SECRET, now),
    refresh_token: refresh,
    expires_at: now + ACCESS_TTL_MS,
    member: { id: member.id, email: member.email, nickname: member.nickname, role: member.role },
  }
}

auth.post('/register', async (c) => {
  const v = validate.register(await body(c))
  if (!v.ok) return err(c, 400, v.error)
  try {
    const m = await members.create(c.env.DB,
      { email: v.value.email, passwordHash: await hash(v.value.password), nickname: v.value.nickname }, c.get('now'))
    return c.json(m, 201)
  } catch (e) {
    if (/UNIQUE/.test(e.message)) return err(c, 409, 'email_taken')
    throw e
  }
})

auth.post('/login', async (c) => {
  const v = validate.login(await body(c))
  if (!v.ok) return err(c, 400, v.error)
  const now = c.get('now')
  const m = await members.findByEmail(c.env.DB, v.value.email)
  if (!m) return err(c, 401, 'unauthorized')
  // 鎖定中一律 401,不驗密碼、不透露被鎖了(作者定:錯 5 次開始鎖,5 → 60 分鐘)
  if (m.locked_until != null && now < m.locked_until) return err(c, 401, 'unauthorized')
  if (!(await verifyPassword(v.value.password, m.password_hash))) {
    await members.recordLoginFailure(c.env.DB, m.id, now)
    return err(c, 401, 'unauthorized')
  }
  if (m.failed_logins > 0) await members.clearLoginFailures(c.env.DB, m.id)
  return c.json(await issue(c, m), 200)
})

// 輪替:舊的撤掉成功才發新的。撤不掉時分兩種 —— 已被撤銷的拿來換 = 重放 → 該成員全部撤銷(C17)。
auth.post('/refresh', async (c) => {
  const b = await body(c)
  if (typeof b?.refresh_token !== 'string') return err(c, 401, 'unauthorized')
  const now = c.get('now')
  const tokenHash = await sha256Hex(b.refresh_token)
  const memberId = await refreshTokens.consume(c.env.DB, tokenHash, now)
  if (!memberId) {
    const row = await refreshTokens.find(c.env.DB, tokenHash)
    if (row?.revoked_at != null) {
      await refreshTokens.revokeAllForMember(c.env.DB, row.member_id, now)
      return err(c, 401, 'refresh_replayed')
    }
    return err(c, 401, 'unauthorized')
  }
  const m = await members.findById(c.env.DB, memberId)
  return c.json(await issue(c, m), 200)
})

auth.post('/logout', requireMember, async (c) => {
  const b = await body(c)
  if (typeof b?.refresh_token === 'string') {
    await refreshTokens.revoke(c.env.DB, await sha256Hex(b.refresh_token), c.get('now'))
  }
  return c.body(null, 204)
})
