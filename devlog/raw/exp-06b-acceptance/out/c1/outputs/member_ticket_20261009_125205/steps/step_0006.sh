python - <<'PY'
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        # Login first
        await page.goto("http://localhost:5173", wait_until="domcontentloaded")
        await page.fill('input[type="email"]', 'member@example.com')
        await page.fill('input[type="password"]', 'password123')
        await page.click('button:has-text("登入")')
        await asyncio.sleep(2)

        # Click on 秋季音樂會 event link
        await page.click('a[href*="events/ev-1"]')
        await asyncio.sleep(2)

        # Select 一般 ticket (already selected by default, but verify)
        await page.select_option('select', value='一般')
        await asyncio.sleep(1)

        # Click seat A1 to reserve it
        await page.click('button:has-text("A1")')
        await asyncio.sleep(1)
        await page.screenshot(path="/work/outputs/member_ticket_20261009_125205/screenshots/5_seat_selected.png")
        print("URL:", page.url)
        print("ARIA SNAPSHOT after seat selection:")
        print(await page.locator("body").aria_snapshot())

        await browser.close()

asyncio.run(main())
PY
