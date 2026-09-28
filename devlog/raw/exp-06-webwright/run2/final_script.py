import asyncio, re
from pathlib import Path
from playwright.async_api import async_playwright

RUN = Path(__file__).parent
SS = RUN / "screenshots"; SS.mkdir(exist_ok=True)
LOG = RUN / "final_script_log.txt"; LOG.write_text("")
BASE = "http://localhost:5173"
step = 0
def log(msg):
    global step; step += 1
    line = f"step {step} action: {msg}"; print(line)
    with LOG.open("a") as f: f.write(line + "\n")
async def shot(pg, name):
    await pg.screenshot(path=str(SS / f"final_execution_{step}_{name}.png"))

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(channel="chrome", headless=True)
        pg = await (await b.new_context(viewport={"width": 1280, "height": 1800})).new_page()
        await pg.goto(BASE, wait_until="networkidle")
        await pg.get_by_role("textbox", name="email").fill("member@example.com")
        await pg.get_by_role("textbox", name="密碼(至少 8 字元)").fill("password123")
        await pg.get_by_role("button", name="登入", exact=True).click()
        await pg.wait_for_url("**/#/events"); await pg.wait_for_timeout(800)
        log(f"login as member@example.com -> url {pg.url}, logout button visible={await pg.get_by_role('button', name='登出').is_visible()}")
        await shot(pg, "login_events_list")

        await pg.get_by_role("link", name=re.compile("秋季音樂會")).click()
        await pg.wait_for_url("**/#/events/ev-1"); await pg.wait_for_timeout(800)
        log(f"open event from list: heading={await pg.get_by_role('heading', level=2).inner_text()!r} url={pg.url}")

        await pg.locator("select#tt").select_option(label=re.compile(r"^一般")) if False else await pg.locator("select#tt").select_option("tt-general")
        await pg.wait_for_timeout(500)
        sel_text = await pg.locator("select#tt option:checked").inner_text()
        log(f"select ticket type: {sel_text!r}")
        seat_btn = pg.locator("button[data-seat].btn-outline").first
        seat = await seat_btn.get_attribute("data-seat")
        await seat_btn.click(); await pg.wait_for_timeout(300)
        log(f"select first available seat {seat}; class now={await seat_btn.get_attribute('class')!r}")
        await shot(pg, "seat_selected")

        await pg.get_by_role("button", name=re.compile(r"保留 1 席")).click()
        await pg.wait_for_timeout(1500)
        snap = await pg.locator("main").aria_snapshot()
        log(f"click 保留 1 席 -> url {pg.url}; page: {snap!r}")
        await shot(pg, "hold_created")

        confirm = pg.get_by_role("button", name=re.compile("確認"))
        await confirm.first.click(); await pg.wait_for_timeout(1500)
        snap = await pg.locator("main").aria_snapshot()
        log(f"click confirm -> url {pg.url}; page: {snap!r}")
        await shot(pg, "order_confirmed")

        await pg.get_by_role("link", name="我的票券").click()
        await pg.wait_for_url("**/#/tickets"); await pg.wait_for_timeout(1000)
        card = pg.locator("main").locator("xpath=.//*[h3][.//p[contains(., $s)]]".replace("$s", repr(seat+" ")) ).first
        await card.scroll_into_view_if_needed()
        card_text = (await card.inner_text()).strip()
        log(f"my tickets: card for seat {seat}: {card_text!r}")
        await shot(pg, "my_tickets")
        with LOG.open("a") as f:
            f.write(f"FINAL: seat={seat}; ticket card={card_text!r}\n")
        await b.close()
asyncio.run(main())
