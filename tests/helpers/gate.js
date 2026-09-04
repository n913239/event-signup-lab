/**
 * 併發閘門 —— 讓所有請求卡在同一點,再一次放行。
 *
 * 為什麼需要這個(2026-09-03 的三個版本):
 *   v1  直接 Promise.all 打 N 個請求  → race 測不出來,因為它們根本沒交錯
 *   v2  加隨機延遲                    → 偶爾中,不可重現,等於沒有
 *   v3  閘門:全部到齊才放行           → 穩定重現,重跑 5 次都一樣
 *
 * 「證明 race 存在」比「修好 race」難得多。沒有穩定重現,
 * 你無法分辨「修好了」和「這次剛好沒中」。
 */

export function createGate(expected) {
  let arrived = 0
  let release
  const opened = new Promise((r) => { release = r })

  return {
    /** 每個併發任務進臨界區前呼叫;最後一個到的人負責開閘 */
    async arrive() {
      arrived++
      if (arrived >= expected) release()
      await opened
    },
    get arrivedCount() { return arrived },
  }
}

/**
 * 跑 n 個同時起跑的任務。
 * @param {number} n
 * @param {(i:number)=>Promise<any>} task  收到 index,回傳結果
 * @returns {Promise<{ok:any[], failed:any[]}>}
 */
export async function runConcurrently(n, task) {
  const gate = createGate(n)
  const jobs = Array.from({ length: n }, async (_, i) => {
    await gate.arrive()
    return task(i)
  })
  const settled = await Promise.allSettled(jobs)
  return {
    ok: settled.filter((s) => s.status === 'fulfilled').map((s) => s.value),
    failed: settled.filter((s) => s.status === 'rejected').map((s) => s.reason),
  }
}

/**
 * 同一個併發情境重跑 times 次,全部要得到同樣的結論。
 * 不穩定的重現 = 沒有重現。
 */
export async function repeat(times, fn) {
  const results = []
  for (let i = 0; i < times; i++) results.push(await fn(i))
  return results
}
