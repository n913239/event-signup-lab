// 時間判定:status 與 opens_at / deadline_at 是兩個真相來源,每個邊界分開寫(docs/spec.md「必須被測試證明的規則」)。
// 時間一律 epoch 毫秒整數,now 從參數進來。
import { describe, it, expect } from 'vitest'
import { canHold, isEarlyBird, isHoldExpired, holdExpiresAt } from '../../src/domain/time-rules.js'

const OPENS = 1_790_000_000_000
const DEADLINE = OPENS + 30 * 86_400_000
const ev = (over = {}) => ({ status: 'on_sale', opens_at: OPENS, deadline_at: DEADLINE, ...over })

describe('canHold', () => {
  it('on_sale 且在開賣與截止之間 → ok', () => {
    expect(canHold(ev(), OPENS + 1)).toEqual({ ok: true })
  })
  it('剛好等於開賣時刻 → ok(opens_at <= now)', () => {
    expect(canHold(ev(), OPENS)).toEqual({ ok: true })
  })
  it('開賣前 1 毫秒 → not_open_yet', () => {
    expect(canHold(ev(), OPENS - 1)).toEqual({ ok: false, reason: 'not_open_yet' })
  })
  it('截止前 1 毫秒 → ok', () => {
    expect(canHold(ev(), DEADLINE - 1)).toEqual({ ok: true })
  })
  it('剛好等於截止時刻 → deadline_passed(now < deadline_at 才算)', () => {
    expect(canHold(ev(), DEADLINE)).toEqual({ ok: false, reason: 'deadline_passed' })
  })
  it('過了截止,即使 status 仍是 on_sale → deadline_passed', () => {
    expect(canHold(ev({ status: 'on_sale' }), DEADLINE + 1)).toEqual({ ok: false, reason: 'deadline_passed' })
  })
  it.each(['draft', 'closed', 'finished'])('status = %s,時間在區間內 → not_on_sale', (status) => {
    expect(canHold(ev({ status }), OPENS + 1)).toEqual({ ok: false, reason: 'not_on_sale' })
  })
})

describe('isEarlyBird', () => {
  const UNTIL = OPENS + 7 * 86_400_000
  it('now < early_bird_until → true', () => {
    expect(isEarlyBird({ early_bird_until: UNTIL }, UNTIL - 1)).toBe(true)
  })
  it('剛好等於 early_bird_until → false', () => {
    expect(isEarlyBird({ early_bird_until: UNTIL }, UNTIL)).toBe(false)
  })
  it('early_bird_until 為 null → false', () => {
    expect(isEarlyBird({ early_bird_until: null }, 0)).toBe(false)
  })
})

describe('isHoldExpired', () => {
  const EXP = OPENS + 600_000
  it('now < expires_at → 未過期', () => {
    expect(isHoldExpired({ expires_at: EXP }, EXP - 1)).toBe(false)
  })
  it('剛好等於 expires_at → 已過期(expires_at <= now)', () => {
    expect(isHoldExpired({ expires_at: EXP }, EXP)).toBe(true)
  })
})

describe('holdExpiresAt', () => {
  it('now + ttl 分鐘(毫秒整數)', () => {
    expect(holdExpiresAt(OPENS, 10)).toBe(OPENS + 600_000)
  })
})
