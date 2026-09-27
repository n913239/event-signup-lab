// 密碼雜湊:PBKDF2-SHA256 100,000 次,格式 pbkdf2$100000$<salt>$<hash>(base64)。
import { describe, it, expect } from 'vitest'
import { hash, verify } from '../../src/lib/password.js'

describe('密碼雜湊', () => {
  it('格式是 pbkdf2$100000$<salt>$<hash>', async () => {
    const stored = await hash('password123')
    const parts = stored.split('$')
    expect(parts).toHaveLength(4)
    expect(parts[0]).toBe('pbkdf2')
    expect(parts[1]).toBe('100000')
    expect(parts[2].length).toBeGreaterThan(0)
    expect(parts[3].length).toBeGreaterThan(0)
  })

  it('同一個密碼兩次雜湊,salt 不同、結果不同', async () => {
    const a = await hash('password123')
    const b = await hash('password123')
    expect(a).not.toBe(b)
    expect(a.split('$')[2]).not.toBe(b.split('$')[2])
  })

  it('對的密碼 true', async () => {
    expect(await verify('password123', await hash('password123'))).toBe(true)
  })

  it('錯的密碼 false', async () => {
    expect(await verify('password124', await hash('password123'))).toBe(false)
  })

  it('格式不對的存值 false,不丟錯', async () => {
    expect(await verify('password123', 'plain')).toBe(false)
    expect(await verify('password123', 'pbkdf2$1$x$y')).toBe(false)
  })
})
