// 測試用的登入小工具。角色只能用 SQL 改(規格層決定 1),測試也一樣。
export async function register(app, env, { email, nickname = 'n', password = 'password123' }) {
  const res = await app.request('/auth/register', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password, nickname }),
  }, env)
  return res.json()
}

export async function login(app, env, { email, password = 'password123' }) {
  const res = await app.request('/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }),
  }, env)
  const body = await res.json()
  return { access: body.access_token, refresh: body.refresh_token, member: body.member }
}

export async function makeStaff(db, memberId) {
  await db.prepare("UPDATE members SET role = 'staff' WHERE id = ?").bind(memberId).run()
}

// 建成員並登入;staff: true 時先用 SQL 升成 staff 再登入(token 裡的 role 才會是 staff)。
export async function userWith(app, env, db, email, { staff = false } = {}) {
  const m = await register(app, env, { email })
  if (staff) await makeStaff(db, m.id)
  return login(app, env, { email })
}

export const bearer = (token, init = {}) => ({ ...init, headers: { ...(init.headers ?? {}), authorization: `Bearer ${token}` } })
export const jsonReq = (method, body, token) => bearer(token, {
  method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
})
