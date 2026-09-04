import { describe, it, expect } from 'vitest'
import { createGate, runConcurrently, repeat } from './gate.js'

// 閘門本身也要被驗過 —— 它是後面所有併發測試的地基。
describe('閘門', () => {
  it('全部到齊之前沒有人通過', async () => {
    const gate = createGate(3)
    let through = 0
    const jobs = [0, 1, 2].map(async () => { await gate.arrive(); through++ })
    // 還沒 await:此時應該沒有人穿過去
    expect(through).toBe(0)
    await Promise.all(jobs)
    expect(through).toBe(3)
  })

  it('runConcurrently 會分開成功與失敗', async () => {
    const { ok, failed } = await runConcurrently(4, async (i) => {
      if (i % 2 === 0) return i
      throw new Error(`no-${i}`)
    })
    expect(ok).toEqual([0, 2])
    expect(failed).toHaveLength(2)
  })

  it('repeat 跑滿指定次數', async () => {
    const r = await repeat(5, async (i) => i)
    expect(r).toEqual([0, 1, 2, 3, 4])
  })
})
