import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

SCREENSHOTS = Path("screenshots")
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        # Just navigate to the events page directly
        print("Navigating...")
        await page.goto("http://localhost:5173/#/events", wait_until="load")
        print("Navigated. URL:", page.url)
        
        await asyncio.sleep(2)
        print("Title:", await page.title())
        
        snapshot = await page.locator("body").aria_snapshot()
        print("ARIA:", snapshot)

        await browser.close()

asyncio.run(main())
