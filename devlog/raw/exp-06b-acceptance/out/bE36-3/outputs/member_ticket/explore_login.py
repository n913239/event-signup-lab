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

        # Go to the login page directly
        print("Navigating...")
        await page.goto("http://localhost:5173/#/events", wait_until="domcontentloaded")
        await asyncio.sleep(2)  # Wait for SPA to handle redirect
        
        print("URL:", page.url)
        
        # Fill in credentials
        await page.fill("input[aria-label='email']", "member@example.com")
        await page.fill("input[aria-label='密碼(至少 8 字元)']", "password123")
        
        # Click login (try different selectors if needed)
        buttons = page.locator("button")
        print("Available buttons:", await buttons.all_text_contents())

        # Click the 登入 button - it should be the first one with that text
        await page.click('button:has-text("登入")')
        
        # Wait a bit for navigation/SPA routing
        print("Clicked login, waiting...")
        await asyncio.sleep(3)

        current = page.url
        title = await page.title()
        
        print("URL after login:", current)
        print("TITLE:", title)

        # Screenshot of logged-in state
        await page.screenshot(path=str(SCREENSHOTS / "explore_2_after_login.png"))

        # ARIA snapshot of the logged-in page
        snapshot = await page.locator("body").aria_snapshot()
        print("ARIA:", snapshot)

        await browser.close()

asyncio.run(main())
