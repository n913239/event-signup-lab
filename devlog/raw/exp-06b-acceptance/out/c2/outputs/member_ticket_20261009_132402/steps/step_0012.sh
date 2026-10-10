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

        # Navigate to event page
        await page.click('a[href*="ev-1"]')
        await asyncio.sleep(2)

        # Inspect the select element options
        print("=== SELECT ELEMENT ===")
        select_html = await page.locator('select').inner_html()
        print(select_html)

        # Try to get option values and labels
        options = await page.locator('select > option').all()
        for i, opt in enumerate(options):
            val = await opt.get_attribute('value')
            txt = await opt.text_content()
            print(f"Option {i}: value='{val}', text='{txt}'")

        await browser.close()

asyncio.run(main())
PY
