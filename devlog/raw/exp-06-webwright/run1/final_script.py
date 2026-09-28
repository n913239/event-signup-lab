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
    with LOG.open("a") as f:
        f.write(line)
    print(line, end="")


async def shot(page, step, name):
    await page.screenshot(path=str(SCREENSHOTS / f"final_execution_{step}_{name}.png"))


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(channel="chrome", headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        await page.goto(BASE, wait_until="networkidle")
        await page.get_by_role("textbox", name="email").fill("member@example.com")
        await page.get_by_role("textbox", name="密碼(至少 8 字元)").fill("password123")
        await page.get_by_role("button", name="登入", exact=True).click()
        await page.get_by_role("button", name="登出").wait_for()
        await page.wait_for_load_state("networkidle")
        await shot(page, 1, "logged_in_events_list")
        log(1, f"login as member@example.com; url={page.url}; 登出 button visible")

        await page.get_by_role("link", name="秋季音樂會").click()
        await page.get_by_role("heading", name="秋季音樂會", level=2).wait_for()
        await page.wait_for_load_state("networkidle")
        await shot(page, 2, "event_page")
        log(2, f"open event 秋季音樂會 from list; url={page.url}")

        tt = page.locator("#tt")
        general_val = await tt.locator("option", has_text="一般").get_attribute("value")
        await tt.select_option(general_val)
        selected_text = await tt.locator("option:checked").inner_text()
        log(3, f"select ticket type 一般 (value={general_val}); selected='{selected_text}'")

        hold_btn = page.locator("#hold")
        seat = None
        for b in await page.locator("[data-seat]").all():
            await b.click()
            if (await hold_btn.inner_text()).strip() == "保留 1 席":
                seat = await b.get_attribute("data-seat")
                break
        assert seat, "no free seat"
        await shot(page, 4, f"seat_{seat}_picked")
        log(4, f"pick free seat {seat}; hold button='{await hold_btn.inner_text()}'")

        await hold_btn.click()
        await page.wait_for_url("**/#/events/*/hold")
        await page.locator("#price").get_by_text("應付").wait_for()
        await page.wait_for_timeout(500)
        title = await page.locator(".card-title").inner_text()
        price = await page.locator("#price").inner_text()
        await shot(page, 5, "hold_page_quote")
        log(5, f"hold created; title='{title}'; quote={price!r}")

        await page.get_by_role("button", name="確認", exact=True).click()
        await page.wait_for_url("**/#/tickets")
        await page.get_by_role("heading", name="我的票券").wait_for()
        await page.wait_for_load_state("networkidle")
        await page.wait_for_timeout(500)
        await shot(page, 6, "my_tickets")
        main_text = await page.locator("main").inner_text()
        log(6, f"confirm order -> redirected to {page.url}")
        with LOG.open("a") as f:
            f.write(f"\nTICKETS_PAGE_TEXT:\n{main_text}\n")

        total = [l for l in price.splitlines() if l.strip()]
        final = f"seat={seat}; hold_quote={' | '.join(total)}"
        with LOG.open("a") as f:
            f.write(f"\nFINAL_RESPONSE: {final}\n")
        print("\nTICKETS:\n" + main_text + "\nFINAL_RESPONSE: " + final)
        await browser.close()


asyncio.run(main())
