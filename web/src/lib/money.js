// web 唯一做「分 → 元」的地方(硬規則 1;scripts/check-money.sh 掃 web/src 時排除這個檔)。
// 全程整數:不做除法,用取餘數拆出元與分。
export function formatCents(cents) {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const yuan = String((abs - (abs % 100)) / 100).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const rest = abs % 100
  return `${sign}NT$${yuan}${rest ? '.' + String(rest).padStart(2, '0') : ''}`
}
