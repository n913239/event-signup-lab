// 時間判定。純邏輯:時間一律 epoch 毫秒整數,now 從參數進來(硬規則 2)。
// status 與 opens_at / deadline_at 是兩個真相來源,各自回自己的 reason。

export function canHold(event, now) {
  if (event.status !== 'on_sale') return { ok: false, reason: 'not_on_sale' }
  if (now < event.opens_at) return { ok: false, reason: 'not_open_yet' }
  if (now >= event.deadline_at) return { ok: false, reason: 'deadline_passed' }
  return { ok: true }
}

export function isEarlyBird(ticketType, now) {
  return ticketType.early_bird_until != null && now < ticketType.early_bird_until
}

export function isHoldExpired(hold, now) {
  return hold.expires_at <= now
}

export function holdExpiresAt(now, ttlMinutes) {
  return now + ttlMinutes * 60_000
}
