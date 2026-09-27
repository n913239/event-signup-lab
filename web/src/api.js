// API 呼叫:帶 bearer、401 時自動 refresh 一次、每個回應都用 x-server-now 校正時鐘。
import { syncServerNow } from './lib/clock.js'

const BASE = import.meta.env.VITE_API_BASE ?? '/api'
let access = null

export const session = {
  get loggedIn() { return !!(access || localStorage.getItem('refresh')) },
  set(tokens) { access = tokens.access_token; localStorage.setItem('refresh', tokens.refresh_token) },
  clear() { access = null; localStorage.removeItem('refresh') },
}

export class ApiError extends Error {
  constructor(status, body) { super(body?.error ?? `http_${status}`); this.status = status; this.body = body }
}

async function raw(method, path, body) {
  const headers = { 'content-type': 'application/json' }
  if (access) headers.authorization = `Bearer ${access}`
  const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  syncServerNow(Number(res.headers.get('x-server-now')))
  const data = res.status === 204 ? null : await res.json().catch(() => null)
  return { res, data }
}

async function refreshOnce() {
  const token = localStorage.getItem('refresh')
  if (!token) return false
  const { res, data } = await raw('POST', '/auth/refresh', { refresh_token: token })
  if (res.status !== 200) { session.clear(); return false }
  session.set(data)
  return true
}

export async function api(method, path, body) {
  let { res, data } = await raw(method, path, body)
  if (res.status === 401 && !path.startsWith('/auth/') && await refreshOnce()) {
    ({ res, data } = await raw(method, path, body))
  }
  if (!res.ok) throw new ApiError(res.status, data)
  return data
}
