// 狀態機(docs/spec.md「狀態機」):活動不做 cancelled;hold / 訂單三個終態。
import { describe, it, expect } from 'vitest'
import { canTransition } from '../../src/domain/states.js'

describe('活動', () => {
  it.each([['draft', 'on_sale'], ['on_sale', 'closed'], ['closed', 'finished']])('%s → %s 可以', (f, t) =>
    expect(canTransition('event', f, t)).toBe(true))
  it.each([['on_sale', 'cancelled'], ['on_sale', 'draft'], ['finished', 'on_sale'], ['draft', 'closed'], ['closed', 'on_sale']])(
    '%s → %s 不行', (f, t) => expect(canTransition('event', f, t)).toBe(false))
})

describe('hold / 訂單', () => {
  it.each([['holding', 'confirmed'], ['holding', 'expired'], ['holding', 'cancelled'], ['confirmed', 'cancelled'], ['confirmed', 'checked_in']])(
    '%s → %s 可以', (f, t) => expect(canTransition('order', f, t)).toBe(true))
  it.each([['cancelled', 'confirmed'], ['expired', 'holding'], ['checked_in', 'cancelled'], ['confirmed', 'holding'], ['expired', 'confirmed']])(
    '%s → %s 不行(終態不能再轉)', (f, t) => expect(canTransition('order', f, t)).toBe(false))
  it('未知的種類 / 狀態 → false', () => {
    expect(canTransition('ticket', 'a', 'b')).toBe(false)
    expect(canTransition('order', 'unknown', 'confirmed')).toBe(false)
  })
})
