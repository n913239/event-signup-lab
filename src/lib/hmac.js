// 票券 QR 的簽章:<orderId>.<HMAC-SHA256(orderId) 的 base64url 前 22 字元>。
// 不含 email、暱稱、金額(C21)。驗證用常數時間比對(規則 IV):重算後逐位元 XOR,不用字串相等。

const enc = new TextEncoder()
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

async function mac(orderId, key) {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(String(orderId))))).slice(0, 22)
}

export async function qrPayload(orderId, key) {
  return `${orderId}.${await mac(orderId, key)}`
}

export async function verifyQrPayload(payload, key) {
  const i = String(payload).lastIndexOf('.')
  if (i <= 0) return false
  const want = enc.encode(await mac(payload.slice(0, i), key))
  const got = enc.encode(payload.slice(i + 1))
  if (want.length !== got.length) return false
  let diff = 0
  for (let j = 0; j < want.length; j++) diff |= want[j] ^ got[j]
  return diff === 0
}
