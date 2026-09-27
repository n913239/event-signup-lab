// refresh_tokens:只存 token_hash。輪替 = 先把舊的撤掉(條件式 UPDATE、看 changes),成功才發新的。
// 不放同一個 batch:UPDATE 命中 0 列不是錯誤、不會回滾,INSERT 會照樣寫進去(docs/spec.md 已驗證的平台事實 2)。
export const REFRESH_TTL_MS = 30 * 86_400_000

export async function insert(db, { tokenHash, memberId }, now) {
  await db.prepare('INSERT INTO refresh_tokens (token_hash, member_id, expires_at, revoked_at) VALUES (?, ?, ?, NULL)')
    .bind(tokenHash, memberId, now + REFRESH_TTL_MS).run()
}

// 撤掉「有效的」那一列;回 member_id(成功)或 null(已撤銷、過期、不存在)。
export async function consume(db, tokenHash, now) {
  const r = await db.prepare(
    'UPDATE refresh_tokens SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?')
    .bind(now, tokenHash, now).run()
  if (r.meta.changes !== 1) return null
  const row = await db.prepare('SELECT member_id FROM refresh_tokens WHERE token_hash = ?').bind(tokenHash).first()
  return row.member_id
}

export const find = (db, tokenHash) =>
  db.prepare('SELECT member_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = ?').bind(tokenHash).first()

export async function revokeAllForMember(db, memberId, now) {
  const r = await db.prepare('UPDATE refresh_tokens SET revoked_at = ? WHERE member_id = ? AND revoked_at IS NULL')
    .bind(now, memberId).run()
  return r.meta.changes
}

export async function revoke(db, tokenHash, now) {
  const r = await db.prepare('UPDATE refresh_tokens SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL')
    .bind(now, tokenHash).run()
  return r.meta.changes
}
