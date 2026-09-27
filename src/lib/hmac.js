// 票券 QR 的簽章:<orderId>.<HMAC-SHA256(orderId) 的 base64url 前 22 字元>。
// 不含 email、暱稱、金額(C21)。本專案只簽不驗(非目標 13):日後寫查驗端 MUST 用 crypto.subtle.verify(規則 IV)。

const enc = new TextEncoder()
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

async function mac(orderId, key) {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(String(orderId))))).slice(0, 22)
}

export async function qrPayload(orderId, key) {
  return `${orderId}.${await mac(orderId, key)}`
}
