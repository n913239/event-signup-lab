import './style.css'
import { api, session } from './api.js'
import { loginPage } from './pages/login.js'
import { eventsPage } from './pages/events.js'
import { eventPage } from './pages/event.js'
import { holdPage } from './pages/hold.js'
import { ticketsPage } from './pages/tickets.js'

// 五個畫面,沒有第六個(docs/spec.md「前端」)。hash 路由,Pages 上不用設 rewrite。
const routes = [
  [/^#\/login$/, loginPage],
  [/^#\/events$/, eventsPage],
  [/^#\/events\/([^/]+)$/, eventPage],
  [/^#\/events\/([^/]+)\/hold$/, holdPage],
  [/^#\/tickets$/, ticketsPage],
]

let cleanup = null
async function render() {
  const hash = location.hash || '#/events'
  if (!session.loggedIn && hash !== '#/login') { location.hash = '#/login'; return }
  document.getElementById('logout').classList.toggle('hidden', !session.loggedIn)
  cleanup?.(); cleanup = null
  const el = document.getElementById('app')
  for (const [re, page] of routes) {
    const m = hash.match(re)
    if (m) { cleanup = (await page(el, ...m.slice(1))) ?? null; return }
  }
  location.hash = '#/events'
}

document.getElementById('logout').addEventListener('click', async () => {
  const token = localStorage.getItem('refresh')
  if (token) await api('POST', '/auth/logout', { refresh_token: token }).catch(() => {})
  session.clear()
  location.hash = '#/login'
})

addEventListener('hashchange', render)
render()
