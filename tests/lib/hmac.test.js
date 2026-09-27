// 票券 QR:<orderId>.<base64url(HMAC-SHA256(orderId))前 22 字元>,不含個資。
// 本專案只簽不驗(C21、非目標 13):src 裡不留任何驗證函式 —— 日後寫查驗端 MUST 用 crypto.subtle.verify(T083)。
import { describe, it, expect } from 'vitest'
import * as hmac from '../../src/lib/hmac.js'
const { qrPayload } = hmac

describe('qrPayload', () => {
  it('格式 <orderId>.<22 字元 base64url>', async () => {
    const p = await qrPayload('42', 'k')
    expect(p).toMatch(/^42\.[A-Za-z0-9_-]{22}$/)
  })
  it('同 id 同 key 結果一樣;換 key 就不一樣', async () => {
    expect(await qrPayload('42', 'k')).toBe(await qrPayload('42', 'k'))
    expect(await qrPayload('42', 'k')).not.toBe(await qrPayload('42', 'other'))
  })
  it('改 id 簽章就變(簽章綁 id)', async () => {
    const p = await qrPayload('42', 'k')
    expect((await qrPayload('43', 'k')).split('.')[1]).not.toBe(p.split('.')[1])
  })
  it('只簽不驗:hmac.js 不匯出任何驗證函式(T083)', () => {
    expect(Object.keys(hmac)).toEqual(['qrPayload'])
  })
})
