python - <<'PY'
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 1800})
        await page.goto("http://localhost:5173/#/login", wait_until="networkidle")
        print("URL:", page.url)
        snap = await page.locator("body").aria_snapshot()
        print("ARIA:")
        print(sap if (sap := snap) else "(empty)")
        await browser.close()

asyncio.run(main())
PY
