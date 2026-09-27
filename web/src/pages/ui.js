// 共用小工具。錯誤訊息刻意只顯示原始 error 代碼(docs/non-goals「刻意保留的醜」:錯誤訊息不友善)。
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
export const errorBox = (e) => `<div role="alert" class="alert alert-error my-2">${esc(e.body?.error ?? e.message)}</div>`
export const fmtTime = (ms) => new Date(ms).toLocaleString('zh-TW', { hour12: false })
