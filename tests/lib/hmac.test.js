// 票券 QR:<orderId>.<base64url(HMAC-SHA256(orderId))前 22 字元>,不含個資;同 key 可重算驗證。
import { describe, it, expect } from 'vitest'
import { qrPayload, verifyQrPayload } from '../../src/lib/hmac.js'

describe('qrPayload', () => {
  it('格式 <orderId>.<22 字元 base64url>', async () => {
    const p = await qrPayload('42', 'k')
    expect(p).toMatch(/^42\.[A-Za-z0-9_-]{22}$/)
  })
  it('同 id 同 key 結果一樣;換 key 就不一樣', async () => {
    expect(await qrPayload('42', 'k')).toBe(await qrPayload('42', 'k'))
    expect(await qrPayload('42', 'k')).not.toBe(await qrPayload('42', 'other'))
  })
  it('同 key 驗得過;改 id 或改簽章都驗不過', async () => {
    const p = await qrPayload('42', 'k')
    expect(await verifyQrPayload(p, 'k')).toBe(true)
    expect(await verifyQrPayload(p.replace(/^42/, '43'), 'k')).toBe(false)
    expect(await verifyQrPayload(p.slice(0, -1) + (p.endsWith('A') ? 'B' : 'A'), 'k')).toBe(false)
    expect(await verifyQrPayload('garbage', 'k')).toBe(false)
  })
})
