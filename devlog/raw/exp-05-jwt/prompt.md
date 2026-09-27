在 Cloudflare Workers 上實作 JWT 登入,要有 refresh token。

介面(要能接進既有的 Hono app):
- 寫 `src/auth.js`,匯出:
  - `auth`:一個 Hono app,掛在 `/auth` 底下,提供
    - `POST /auth/register` body `{ email, password, nickname }` → 201 `{ id, email, nickname, role }`
    - `POST /auth/login` body `{ email, password }` → 200 `{ access_token, refresh_token, expires_at, member }`
    - `POST /auth/refresh` body `{ refresh_token }` → 200 同上
    - `POST /auth/logout` body `{ refresh_token }` → 204
  - `requireMember`:Hono middleware,給其他需要登入的路由用;通過時 `c.set('member', { id, role })`
- 金鑰在 `c.env.JWT_SECRET`;資料庫是 D1,binding `c.env.DB`,表已經建好:

```sql
CREATE TABLE members (
  id TEXT PRIMARY KEY NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
  nickname TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member', created_at INTEGER NOT NULL
) STRICT;
CREATE TABLE refresh_tokens (
  token_hash TEXT PRIMARY KEY NOT NULL, member_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL, revoked_at INTEGER
) STRICT;
```

只寫 `src/auth.js` 這一個檔,不要寫測試。
