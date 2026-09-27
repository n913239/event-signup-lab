// 共用小工具。錯誤代碼翻成中文(示範時好讀);沒翻到的原樣顯示代碼。
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const MESSAGES = {
  invalid_input: '輸入格式不對',
  unauthorized: '帳號或密碼錯誤,或登入已過期',
  email_taken: '這個 email 已經註冊過了',
  forbidden: '沒有權限',
  not_found: '找不到,或不屬於你',
  not_on_sale: '這個活動目前不能報名(未開賣、已截止或已關閉)',
  seat_taken: '選的座位有人先保留了,請換座位',
  hold_exists: '你在這個活動已經有一筆保留中的座位',
  sold_out: '這個票種剩餘名額不夠',
  hold_expired: '保留已過期,請重新選位',
  terminal_state: '這筆已經結束,不能再操作',
  promo_rejected: '優惠碼無法使用(不存在、過期或已用過)',
  capacity_below_sold: '名額不能少於已售出的數量',
  capacity_exceeded: '所有票種的名額加起來不能超過 100',
}
export const messageOf = (e) => MESSAGES[e.body?.error] ?? e.body?.error ?? e.message
export const errorBox = (e) => `<div role="alert" class="alert alert-error my-2">${esc(messageOf(e))}</div>`
export const fmtTime = (ms) => new Date(ms).toLocaleString('zh-TW', { hour12: false })
