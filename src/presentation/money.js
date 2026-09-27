// 伺服器端唯一可以做「分 → 元」的地方(硬規則 1;check-money.sh 不掃 src/presentation/)。
// API 回的永遠是整數分;這裡只給需要人看的字串(例如 log、未來的收據)用。
export function centsToDisplay(cents) {
  const yuan = Math.trunc(cents / 100)
  const rest = Math.abs(cents % 100)
  const y = yuan.toLocaleString('en-US')
  return rest ? `${y}.${String(rest).padStart(2, '0')}` : y
}
