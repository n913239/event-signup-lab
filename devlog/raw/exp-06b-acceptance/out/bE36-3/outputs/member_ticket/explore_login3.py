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
        
        print("URL:", page.url)
        print("Title:", await page.title())

        # Fill in credentials
        await page.fill("input[aria-label='email']", "member@example.com")
        await page.fill("input[aria-label='密碼(至少 8 字元)']", "password123")

        # Check if the login button exists by role
        try:
            btn = page.get_by_role("button", name="登入")
            await btn.click()
        except Exception as e:
            print("get_by_role failed, trying selector:", str(e)[:100])
            await page.click('button:has-text("登入")')

        # Check immediately - don't wait for networkidle
        print("Clicked. Checking state...")

        # Get URL immediately
        url = page.url
        print("URL:", url)

        # Get title  
        try:
            title = await page.title()
            print("Title:", title)
        except:
            print("(no title)")

        # Get page state  
        try:
            ready = await page.evaluate("document.readyState")
            print("readyState:", ready)
        except Exception as e:
            print("evaluate error:", str(e)[:80])

        # Try to get body text
        try:
            snapshot = await page.locator("body").aria_snapshot()
            print("ARIA:", snapshot)
        except Exception as e:
            print("ARIA error (page may be redirecting):", str(e)[:150])

        await browser.close()
        print("DONE")

asyncio.run(main())
