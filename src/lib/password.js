// 密碼雜湊:PBKDF2-SHA256,100,000 次,salt 16 bytes。
// 存成 pbkdf2$100000$<salt base64>$<hash base64>,次數寫在存值裡,日後調高不用遷移舊資料。
// 比對走常數時間(規則 IV):Workers 有 crypto.subtle.timingSafeEqual,Node 測試環境沒有,退回逐位元 XOR。

const ITERATIONS = 100_000
const enc = new TextEncoder()
const b64 = (bytes) => btoa(String.fromCharCode(...bytes))
const unb64 = (s) => Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0))

async function derive(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256)
  return new Uint8Array(bits)
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false
  if (typeof crypto.subtle.timingSafeEqual === 'function') return crypto.subtle.timingSafeEqual(a, b)
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

export async function hash(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return `pbkdf2$${ITERATIONS}$${b64(salt)}$${b64(await derive(password, salt, ITERATIONS))}`
}

export async function verify(password, stored) {
  const parts = String(stored).split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2' || parts[1] !== String(ITERATIONS)) return false
  try {
    const wanted = unb64(parts[3])
    const got = await derive(password, unb64(parts[2]), ITERATIONS)
    return constantTimeEqual(got, wanted)
  } catch {
    return false
  }
}
