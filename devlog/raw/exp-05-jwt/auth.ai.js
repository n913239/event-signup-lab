import { Hono } from 'hono'
import { sign, verify } from 'hono/jwt'

const ACCESS_TTL = 15 * 60 // 秒
const REFRESH_TTL = 30 * 24 * 60 * 60 // 秒
const JWT_ALG = 'HS256'
// Workers 的 WebCrypto 對 PBKDF2 迭代次數上限是 100,000
const PBKDF2_ITERATIONS = 100_000
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const enc = new TextEncoder()
const now = () => Math.floor(Date.now() / 1000)

// ---------- 編碼工具 ----------

function toBase64Url(bytes) {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  return Uint8Array.from(bin, (ch) => ch.charCodeAt(0))
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

// ---------- 密碼 ----------

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256)
  return new Uint8Array(bits)
}

// 格式:pbkdf2-sha256$<iterations>$<salt>$<hash>
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS)
  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(hash)}`
}

async function verifyPassword(password, stored) {
  const [scheme, iter, salt, hash] = stored.split('$')
  const iterations = Number(iter)
  if (scheme !== 'pbkdf2-sha256' || !Number.isInteger(iterations) || iterations < 1 || !salt || !hash) return false
  const actual = await pbkdf2(password, fromBase64Url(salt), iterations)
  return timingSafeEqual(actual, fromBase64Url(hash))
}

// email 不存在時也跑一次 PBKDF2,讓回應時間不洩漏帳號是否存在
let dummyHash
async function burnPasswordCheck(password) {
  dummyHash ??= await hashPassword('dummy-password-for-timing')
  await verifyPassword(password, dummyHash)
}

// ---------- Token ----------

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(str))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function getSecret(c) {
  const secret = c.env?.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is not configured')
  return secret
}

function publicMember(m) {
  return { id: m.id, email: m.email, nickname: m.nickname, role: m.role }
}

async function issueTokens(c, member) {
  const iat = now()
  const expiresAt = iat + ACCESS_TTL
  const accessToken = await sign(
    { sub: member.id, role: member.role, typ: 'access', iat, exp: expiresAt },
    getSecret(c),
    JWT_ALG,
  )

  // refresh token 是不透明亂數,DB 只存 SHA-256,外洩的 DB 內容無法直接拿來用
  const refreshToken = toBase64Url(crypto.getRandomValues(new Uint8Array(32)))
  await c.env.DB.prepare(
    'INSERT INTO refresh_tokens (token_hash, member_id, expires_at, revoked_at) VALUES (?, ?, ?, NULL)',
  )
    .bind(await sha256Hex(refreshToken), member.id, iat + REFRESH_TTL)
    .run()

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: expiresAt,
    member: publicMember(member),
  }
}

// ---------- 請求工具 ----------

async function readJson(c) {
  try {
    const body = await c.req.json()
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null
  } catch {
    return null
  }
}

const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0
const normalizeEmail = (email) => email.trim().toLowerCase()

// ---------- 路由 ----------

export const auth = new Hono()

auth.post('/register', async (c) => {
  const body = await readJson(c)
  if (!body) return c.json({ error: 'invalid JSON body' }, 400)

  const { password } = body
  const email = typeof body.email === 'string' ? normalizeEmail(body.email) : ''
  const nickname = typeof body.nickname === 'string' ? body.nickname.trim() : ''

  if (!EMAIL_RE.test(email) || email.length > 254) return c.json({ error: 'invalid email' }, 400)
  if (typeof password !== 'string' || password.length < 8 || password.length > 256) {
    return c.json({ error: 'password must be 8-256 characters' }, 400)
  }
  if (!nickname || nickname.length > 50) return c.json({ error: 'nickname must be 1-50 characters' }, 400)

  const exists = await c.env.DB.prepare('SELECT 1 FROM members WHERE email = ?').bind(email).first()
  if (exists) return c.json({ error: 'email already registered' }, 409)

  // role 一律由伺服器決定,不接受 body 傳入
  const member = { id: crypto.randomUUID(), email, nickname, role: 'member' }
  try {
    await c.env.DB.prepare(
      'INSERT INTO members (id, email, password_hash, nickname, role, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
      .bind(member.id, email, await hashPassword(password), nickname, member.role, now())
      .run()
  } catch (err) {
    // 兩個請求同時註冊同一個 email
    if (String(err?.message).includes('UNIQUE')) return c.json({ error: 'email already registered' }, 409)
    throw err
  }

  return c.json(member, 201)
})

auth.post('/login', async (c) => {
  const body = await readJson(c)
  if (!body || !isNonEmptyString(body.email) || !isNonEmptyString(body.password)) {
    return c.json({ error: 'email and password are required' }, 400)
  }

  const member = await c.env.DB.prepare(
    'SELECT id, email, nickname, role, password_hash FROM members WHERE email = ?',
  )
    .bind(normalizeEmail(body.email))
    .first()

  if (!member) {
    await burnPasswordCheck(body.password)
    return c.json({ error: 'invalid email or password' }, 401)
  }
  if (!(await verifyPassword(body.password, member.password_hash))) {
    return c.json({ error: 'invalid email or password' }, 401)
  }

  return c.json(await issueTokens(c, member), 200)
})

auth.post('/refresh', async (c) => {
  const body = await readJson(c)
  if (!body || !isNonEmptyString(body.refresh_token)) return c.json({ error: 'refresh_token is required' }, 400)

  const db = c.env.DB
  const tokenHash = await sha256Hex(body.refresh_token)
  const ts = now()

  // Rotation:用單一條件式 UPDATE 認領舊 token,同一個 token 只會有一個請求成功
  const claimed = await db
    .prepare(
      `UPDATE refresh_tokens SET revoked_at = ?
       WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?
       RETURNING member_id`,
    )
    .bind(ts, tokenHash, ts)
    .first()

  if (!claimed) {
    // 已撤銷的 token 又被拿來用 → 視為外洩,撤銷該會員所有 refresh token
    const old = await db
      .prepare('SELECT member_id, revoked_at FROM refresh_tokens WHERE token_hash = ?')
      .bind(tokenHash)
      .first()
    if (old?.revoked_at != null) {
      await db
        .prepare('UPDATE refresh_tokens SET revoked_at = ? WHERE member_id = ? AND revoked_at IS NULL')
        .bind(ts, old.member_id)
        .run()
    }
    return c.json({ error: 'invalid refresh token' }, 401)
  }

  // 重新讀會員,確保帳號仍存在且 role 是最新的
  const member = await db
    .prepare('SELECT id, email, nickname, role FROM members WHERE id = ?')
    .bind(claimed.member_id)
    .first()
  if (!member) return c.json({ error: 'invalid refresh token' }, 401)

  return c.json(await issueTokens(c, member), 200)
})

auth.post('/logout', async (c) => {
  const body = await readJson(c)
  if (!body || !isNonEmptyString(body.refresh_token)) return c.json({ error: 'refresh_token is required' }, 400)

  // 不論 token 是否存在都回 204,不洩漏 token 狀態
  await c.env.DB.prepare('UPDATE refresh_tokens SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL')
    .bind(now(), await sha256Hex(body.refresh_token))
    .run()

  return c.body(null, 204)
})

// ---------- Middleware ----------

export async function requireMember(c, next) {
  const header = c.req.header('Authorization') ?? ''
  const match = /^Bearer\s+(\S+)$/i.exec(header)
  if (!match) return c.json({ error: 'missing bearer token' }, 401, { 'WWW-Authenticate': 'Bearer' })

  let payload
  try {
    // 明確指定演算法,避免 alg 混淆;verify 也會檢查 exp
    payload = await verify(match[1], getSecret(c), JWT_ALG)
  } catch (err) {
    if (err?.message === 'JWT_SECRET is not configured') throw err
    return c.json({ error: 'invalid or expired token' }, 401, { 'WWW-Authenticate': 'Bearer error="invalid_token"' })
  }

  if (payload.typ !== 'access' || typeof payload.sub !== 'string' || typeof payload.role !== 'string') {
    return c.json({ error: 'invalid or expired token' }, 401, { 'WWW-Authenticate': 'Bearer error="invalid_token"' })
  }

  c.set('member', { id: payload.sub, role: payload.role })
  await next()
}
