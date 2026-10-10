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
        await asyncio.sleep(2)
        
        print("URL:", page.url)
        print("Title:", await page.title())

        # Fill in credentials
        await page.fill("input[aria-label='email']", "member@example.com")
        await page.fill("input[aria-label='密碼(至少 8 字元)']", "password123")
        
        # Click login (try different selectors if needed)
        buttons = page.locator("button")
        print("Available buttons:", await buttons.all_text_contents())

        # Click the 登入 button
        print("About to click login...")
        await page.click('button:has-text("登入")')
        
        # Check what's happening - use page.wait_for_load_state
        print("Page state after click:", await page.evaluate("document.readyState"))

        # Try waiting for any network request to complete
        try:
            await page.wait_for_load_state("networkidle", timeout=5000)
        except Exception as e:
            print("networkidle wait error (may be normal):", str(e)[:100])
        
        await asyncio.sleep(2)

        current = page.url
        
        # Try getting the body text to see if there's error info
        body_text = await page.locator("main").inner_text()
        
        print("URL after login:", current)
        print("Main content:", body_text[:500])

        # ARIA snapshot
        try:
            snapshot = await page.locator("body").aria_snapshot()
            print("ARIA:", snapshot)
        except Exception as e:
            print("ARIA error:", str(e))

        await browser.close()

asyncio.run(main())
