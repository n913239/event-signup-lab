// 報名系統的時間規則。所有時間皆為 epoch 毫秒。
// 每個函式都可傳入 `now`（預設 Date.now()），方便測試與在同一請求內使用一致的時間點。
//
// 邊界約定：區間一律為「含起點、不含終點」[start, end)
//   - 開賣：now >= opens_at 才算已開賣
//   - 截止：now >= deadline_at 即視為已截止
//   - 早鳥：now <  early_bird_until 才算早鳥
//   - 保留：now >= expires_at 即視為已過期

const MINUTE_MS = 60 * 1000;

/**
 * 判斷活動現在能否保留座位。
 * @param {{ status: 'draft'|'on_sale'|'closed'|'finished', opens_at: number, deadline_at: number }} event
 * @param {number} [now]
 * @returns {{ ok: true } | { ok: false, reason: 'not_on_sale'|'not_open_yet'|'deadline_passed' }}
 */
export function canHold(event, now = Date.now()) {
  if (event.status !== 'on_sale') return { ok: false, reason: 'not_on_sale' };
  if (now < event.opens_at) return { ok: false, reason: 'not_open_yet' };
  if (now >= event.deadline_at) return { ok: false, reason: 'deadline_passed' };
  return { ok: true };
}

/**
 * 判斷現在是否在早鳥期間。early_bird_until 為 null/undefined 表示沒有早鳥。
 * @param {{ early_bird_until: number|null }} ticketType
 * @param {number} [now]
 * @returns {boolean}
 */
export function isEarlyBird(ticketType, now = Date.now()) {
  const until = ticketType.early_bird_until;
  if (until == null) return false;
  return now < until;
}

/**
 * 判斷保留是否已過期。
 * @param {{ expires_at: number }} hold
 * @param {number} [now]
 * @returns {boolean}
 */
export function isHoldExpired(hold, now = Date.now()) {
  return now >= hold.expires_at;
}

/**
 * 依保留時長（分鐘）算出到期時刻。
 * @param {number} minutes 正數
 * @param {number} [now]
 * @returns {number} epoch 毫秒
 */
export function holdExpiresAt(minutes, now = Date.now()) {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    throw new RangeError(`hold minutes must be a positive number, got ${minutes}`);
  }
  return now + minutes * MINUTE_MS;
}
