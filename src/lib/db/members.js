// members 的 SQL 存取。id 由應用層產生(TEXT)。
export async function create(db, { email, passwordHash, nickname }, now) {
  const id = crypto.randomUUID()
  await db.prepare('INSERT INTO members (id, email, password_hash, nickname, role, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, email, passwordHash, nickname, 'member', now).run()
  return { id, email, nickname, role: 'member' }
}

export const findByEmail = (db, email) =>
  db.prepare('SELECT id, email, password_hash, nickname, role, failed_logins, locked_until FROM members WHERE email = ?').bind(email).first()

// 登入失敗:累計一次;第 5 次起鎖 5 → 10 → 20 → 40 → 60 分鐘(上限 1 小時)。
// WHERE 排除鎖定中的帳號 —— 鎖定期間的嘗試不累計。指數封頂在 4,避免位移溢位。
export async function recordLoginFailure(db, id, now) {
  const r = await db.prepare(`UPDATE members SET
      failed_logins = failed_logins + 1,
      locked_until = CASE WHEN failed_logins + 1 >= 5
        THEN ? + MIN(60, 5 * (1 << MIN(4, failed_logins + 1 - 5))) * 60000
        ELSE locked_until END
    WHERE id = ? AND (locked_until IS NULL OR locked_until <= ?)`).bind(now, id, now).run()
  return r.meta.changes
}

export async function clearLoginFailures(db, id) {
  const r = await db.prepare('UPDATE members SET failed_logins = 0, locked_until = NULL WHERE id = ? AND failed_logins > 0').bind(id).run()
  return r.meta.changes
}

export const findById = (db, id) =>
  db.prepare('SELECT id, email, nickname, role FROM members WHERE id = ?').bind(id).first()
