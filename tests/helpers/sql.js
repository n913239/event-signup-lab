// 把一份 .sql 切成 D1 batch 吃得下的單句。
// 1. 先剝整行註解(檔頭註解接在第一句前面時,整句會被當註解丟掉 —— 2026-09-27 踩到)
// 2. 以行尾的 ; 切句,但 CREATE TRIGGER … END; 整塊算一句(trigger 本體裡的 ; 不是句尾)
export function splitSql(text) {
  const out = []
  let buf = []
  let inTrigger = false
  for (const line of text.replace(/^\s*--.*$/gm, '').split('\n')) {
    buf.push(line)
    if (/\bCREATE\s+(TEMP\s+)?TRIGGER\b/i.test(line)) inTrigger = true
    const ends = inTrigger ? /^\s*END\s*;\s*$/i.test(line) : /;\s*$/.test(line)
    if (ends) {
      out.push(buf.join('\n').trim().replace(/;\s*$/, ''))
      buf = []
      inTrigger = false
    }
  }
  const rest = buf.join('\n').trim()
  if (rest) out.push(rest)
  return out.filter(Boolean)
}
