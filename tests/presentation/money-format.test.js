// web 的金額顯示與 iOS 共用同一份向量(tests/fixtures/money-format.json);iOS 那支在 ios/EventSignup/Tests(SC-007)。
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { formatCents } from '../../web/src/lib/money.js'

const { cases } = JSON.parse(readFileSync('tests/fixtures/money-format.json', 'utf8'))

describe('web formatCents 與共用向量逐字相同', () => {
  it.each(cases)('$cents → $text', ({ cents, text }) => expect(formatCents(cents)).toBe(text))
})
