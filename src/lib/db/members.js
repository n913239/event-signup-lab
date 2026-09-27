// members 的 SQL 存取。id 由應用層產生(TEXT)。
export async function create(db, { email, passwordHash, nickname }, now) {
  const id = crypto.randomUUID()
  await db.prepare('INSERT INTO members (id, email, password_hash, nickname, role, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, email, passwordHash, nickname, 'member', now).run()
  return { id, email, nickname, role: 'member' }
}

export const findByEmail = (db, email) =>
  db.prepare('SELECT id, email, password_hash, nickname, role FROM members WHERE email = ?').bind(email).first()

export const findById = (db, id) =>
  db.prepare('SELECT id, email, nickname, role FROM members WHERE id = ?').bind(id).first()
