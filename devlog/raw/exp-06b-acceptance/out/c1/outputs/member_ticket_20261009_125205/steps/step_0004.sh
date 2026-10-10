python - <<'PY'
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        # Step 1: Login with member credentials
        await page.goto("http://localhost:5173", wait_until="domcontentloaded")
        await page.fill('input[type="email"]', 'member@example.com')
        await page.fill('input[type="password"]', 'password123')
        await page.click('button:has-text("登入")')
        await asyncio.sleep(2)
        await page.screenshot(path="/work/outputs/member_ticket_20261009_125205/screenshots/2_after_login.png")
        print("URL after login:", page.url)
        print("TITLE:", await page.title())
        print("ARIA SNAPSHOT after login:")
        print(await page.locator("body").aria_snapshot())

        # Step 2: Click on 活動報名 to go to events list
        await page.click('a[href*="events"]')
        await asyncio.sleep(2)
        await page.screenshot(path="/work/outputs/member_ticket_20261009_125205/screenshots/3_events_list.png")
        print("URL after events:", page.url)
        print("TITLE:", await page.title())
        print("ARIA SNAPSHOT events list:")
        print(await page.locator("body").aria_snapshot())

        await browser.close()

asyncio.run(main())
PY
