/**
 * 骨架階段的佔位回應。
 *
 * 17 條 endpoint 全部先回 501,理由有兩個:
 *   1. 契約(openapi.yaml)要先於任何回 200 的 handler commit ——
 *      兩個 commit 的先後就是「契約先行」的證據(Day 23)
 *   2. schema 是 Day 22 的實驗對象,骨架不能先把資料表寫死
 *      (見 docs/EXPERIMENT-PROTOCOL.md)。所以這一層零 SQL。
 */
export const notImplemented = (c) =>
  c.json({ error: 'not_implemented', server_now: c.get('now') }, 501)
