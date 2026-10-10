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

        # Click on 秋季音樂會 event link - this goes to /hold because of existing hold
        await page.click('a[href*="events/ev-1"]')
        await asyncio.sleep(2)
        print("URL:", page.url)
        print("TITLE:", await page.title())
        print("ARIA SNAPSHOT (hold page):")
        aria = await page.locator("body").aria_snapshot()
        print(aria)

        # Check if there's a 放棄 button to cancel existing hold
        try:
            abandon_btn = page.locator('button:has-text("放棄")')
            print(f"\nFound 放棄 button: {await abandon_btn.is_visible()}")
            await page.screenshot(path="/work/outputs/member_ticket_20261009_125205/screenshots/hold_page.png")
        except:
            print("No 放棄 button found")

        await browser.close()

asyncio.run(main())
PY
