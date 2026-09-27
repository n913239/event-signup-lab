// 自製 JWT(HS256)。簽章比對只准用 crypto.subtle.verify(規則 IV:常數時間),不自己重算再比字串。
// now 從參數進來(毫秒);exp / iat 照 JWT 慣例存秒。

const enc = new TextEncoder()
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromB64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
const HEADER = b64url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))

const key = (secret, usage) =>
  crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [usage])

export const ACCESS_TTL_MS = 15 * 60_000

export async function sign(claims, secret, now) {
  const iat = Math.floor(now / 1000)
  const body = b64url(enc.encode(JSON.stringify({ ...claims, iat, exp: iat + ACCESS_TTL_MS / 1000 })))
  const data = `${HEADER}.${body}`
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await key(secret, 'sign'), enc.encode(data)))
  return `${data}.${b64url(sig)}`
}

// 回 claims 或 null。任何格式問題都回 null(呼叫端一律 401),不丟例外。
export async function verify(token, secret, now) {
  try {
    const parts = String(token).split('.')
    if (parts.length !== 3) return null
    const [h, p, s] = parts
    const header = JSON.parse(new TextDecoder().decode(fromB64url(h)))
    if (header.alg !== 'HS256' || header.typ !== 'JWT') return null      // alg: none、換演算法一律拒
    const ok = await crypto.subtle.verify('HMAC', await key(secret, 'verify'), fromB64url(s), enc.encode(`${h}.${p}`))
    if (!ok) return null
    const claims = JSON.parse(new TextDecoder().decode(fromB64url(p)))
    if (!Number.isInteger(claims.exp) || now >= claims.exp * 1000) return null
    return claims
  } catch {
    return null
  }
}

// refresh token:32 bytes 亂數;DB 只存 SHA-256(hex)。
export function newRefreshToken() {
  return b64url(crypto.getRandomValues(new Uint8Array(32)))
}

export async function sha256Hex(s) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)))
  return [...d].map((b) => b.toString(16).padStart(2, '0')).join('')
}
