import { serverNow } from './clock.js'

// 以伺服器時間倒數到 expiresAt。每秒呼叫 onTick(剩餘毫秒),歸零時呼叫 onExpire 一次。回傳停止函式。
export function countdown(expiresAt, onTick, onExpire) {
  const tick = () => {
    const left = Math.max(0, expiresAt - serverNow())
    onTick(left)
    if (left === 0) { clearInterval(id); onExpire() }
  }
  const id = setInterval(tick, 1000)
  tick()
  return () => clearInterval(id)
}

export function mmss(ms) {
  const s = (ms - (ms % 1000)) / 1000
  return `${String((s - (s % 60)) / 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
