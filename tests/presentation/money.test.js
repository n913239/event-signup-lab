import { describe, it, expect } from 'vitest'
import { centsToDisplay } from '../../src/presentation/money.js'

describe('centsToDisplay(分 → 元字串)', () => {
  it.each([[0, '0'], [100, '1'], [100000, '1,000'], [71000, '710'], [314000, '3,140'], [150, '1.50'], [5, '0.05']])(
    '%i 分 → %s', (c, s) => expect(centsToDisplay(c)).toBe(s))
})
