import { api, session } from '../api.js'
import { errorBox } from './ui.js'

export function loginPage(el) {
  el.innerHTML = `
    <div class="card bg-base-100 shadow max-w-sm mx-auto"><div class="card-body">
      <h2 class="card-title">登入 / 註冊</h2>
      <form id="f" class="flex flex-col gap-2">
        <input name="email" type="email" required placeholder="email" class="input w-full" />
        <input name="password" type="password" required minlength="8" placeholder="密碼(至少 8 字元)" class="input w-full" />
        <input name="nickname" placeholder="暱稱(註冊才需要)" class="input w-full" />
        <div class="flex gap-2">
          <button name="act" value="login" class="btn btn-primary flex-1">登入</button>
          <button name="act" value="register" class="btn flex-1">註冊並登入</button>
        </div>
      </form>
      <div id="err"></div>
    </div></div>`
  el.querySelector('#f').addEventListener('submit', async (ev) => {
    ev.preventDefault()
    const f = new FormData(ev.target)
    const cred = { email: f.get('email'), password: f.get('password') }
    try {
      if (ev.submitter.value === 'register') await api('POST', '/auth/register', { ...cred, nickname: f.get('nickname') || cred.email })
      session.set(await api('POST', '/auth/login', cred))
      location.hash = '#/events'
    } catch (e) { el.querySelector('#err').innerHTML = errorBox(e) }
  })
}
