python - <<'PY'
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        # Step 1: Go to the start page and explore navigation
        await page.goto("http://localhost:5173", wait_until="domcontentloaded")
        await page.screenshot(path="/work/outputs/member_ticket_20261009_132402/screenshots/step1_homepage.png")
        print("URL:", page.url)
        print("TITLE:", await page.title())
        print("ARIA SNAPSHOT:")
        print(await page.locator("body").aria_snapshot())
        await browser.close()

asyncio.run(main())
PY
