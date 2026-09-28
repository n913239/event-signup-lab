import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

RUN_DIR = Path(__file__).parent
SCREENSHOTS = RUN_DIR / "screenshots"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)
LOG = RUN_DIR / "final_script_log.txt"
LOG.write_text("")
BASE = "http://localhost:5173"

def log(step, msg):
    line = f"step {step} action: {msg}\n"
    with LOG.open("a") as f: f.write(line)
    print(line, end="")

async def shot(page, name):
    await page.screenshot(path=str(SCREENSHOTS / f"final_execution_{name}.png"))

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(channel="chrome", headless=True)
        page = await (await browser.new_context(viewport={"width": 1280, "height": 1800})).new_page()

        await page.goto(BASE, wait_until="networkidle")
        await shot(page, "1_login_page")
        log(1, f"open {page.url} (login page)")

        await page.get_by_role("textbox", name="email").fill("member@example.com")
        await page.get_by_role("textbox", name="密碼(至少 8 字元)").fill("password123")
        await page.get_by_role("button", name="登入", exact=True).click()
        await page.wait_for_url("**/#/events")
        await page.get_by_role("button", name="登出").wait_for()
        await shot(page, "2_logged_in_event_list")
        log(2, f"CP1 login as member@example.com -> {page.url}, 登出 button visible")

        await page.get_by_role("link", name="秋季音樂會").click()
        await page.locator("#tt").wait_for()
        title = (await page.locator("main h2").inner_text()).strip()
        await shot(page, "3_event_detail")
        log(3, f"CP2 open event detail: '{title}' at {page.url}")

        await page.locator("#tt").select_option(label=[o for o in await page.locator("#tt option").all_inner_texts() if o.startswith("一般")][0])
        tt_label = await page.locator("#tt option:checked").inner_text()
        seat_btn = page.locator("[data-seat].btn-outline:not(.btn-disabled)").first
        seat = await seat_btn.get_attribute("data-seat")
        await seat_btn.click()
        hold_txt = await page.locator("#hold").inner_text()
        await shot(page, "4_select_general_seat")
        log(4, f"CP3 select ticket type '{tt_label}', pick first free seat {seat}; button='{hold_txt}'")

        await page.locator("#hold").click()
        await page.wait_for_url("**/hold")
        await page.locator("#price").get_by_text("應付").wait_for()
        hold_title = (await page.locator("h2.card-title").inner_text()).strip()
        price_txt = (await page.locator("#price").inner_text()).strip()
        await shot(page, "5_hold_page")
        log(5, f"CP3 hold created: '{hold_title}'; price box: {price_txt!r}")

        await page.get_by_role("button", name="確認").click()
        await page.wait_for_url("**/#/tickets")
        await page.locator("main .card").first.wait_for()
        await shot(page, "6_my_tickets")
        cards = page.locator("main .card")
        match = None
        for i in range(await cards.count()):
            t = (await cards.nth(i).inner_text()).strip()
            if "秋季音樂會" in t and seat in t:
                match = t
        log(6, f"CP4/CP5 confirm order -> {page.url}; ticket card text: {match!r}")

        with LOG.open("a") as f:
            f.write(f"\nFINAL_RESPONSE: seat={seat}; hold price box={price_txt!r}; tickets page card={match!r}\n")
        await browser.close()

asyncio.run(main())
