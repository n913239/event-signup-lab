python - <<'PY'
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        # Log in first
        await page.goto("http://localhost:5173", wait_until="domcontentloaded")
        await page.fill('input[type="email"]', 'member@example.com')
        await page.fill('input[type="password"]', 'password123')
        await page.click('button:has-text("登入")')
        await asyncio.sleep(2)

        # Click on 秋季音樂會 event link
        await page.click('a[href*="ev-1"]')
        await asyncio.sleep(2)

        print("URL:", page.url)
        print("TITLE:", await page.title())
        print("ARIA SNAPSHOT:")
        print(await page.locator("body").aria_snapshot())
        await browser.close()

asyncio.run(main())
PY
