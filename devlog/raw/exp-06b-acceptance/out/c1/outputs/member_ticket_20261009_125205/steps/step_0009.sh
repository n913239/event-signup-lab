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

        # Click seat A1
        await page.click('button:has-text("A1")')
        await asyncio.sleep(1)

        # Click 保留 1 席 button
        await page.click('button:has-text("保留")')
        await asyncio.sleep(2)

        # Click 確認 button to confirm order
        await page.click('button:has-text("確認")')
        await asyncio.sleep(2)
        await page.screenshot(path="/work/outputs/member_ticket_20261009_125205/screenshots/7_order_confirmed.png")
        print("URL after confirm:", page.url)
        print("TITLE:", await page.title())
        print("ARIA SNAPSHOT after order confirmation:")
        print(await page.locator("body").aria_snapshot())

        # Now navigate to 我的票券 page
        await page.click('a[href*="tickets"]')
        await asyncio.sleep(2)
        await page.screenshot(path="/work/outputs/member_ticket_20261009_125205/screenshots/8_my_tickets.png")
        print("URL on tickets page:", page.url)
        print("TITLE:", await page.title())
        print("ARIA SNAPSHOT tickets page:")
        print(await page.locator("body").aria_snapshot())

        await browser.close()

asyncio.run(main())
PY
