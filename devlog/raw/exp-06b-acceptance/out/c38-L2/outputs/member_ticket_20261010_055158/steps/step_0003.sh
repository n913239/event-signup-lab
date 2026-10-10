python - <<'PY'
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 1800})
        await page.goto("http://localhost:5173", wait_until="networkidle")
        print("URL:", page.url)
        print("TITLE:", await page.title())
        # Print visible text
        body_text = await page.evaluate("() => document.body.innerText")
        print("BODY TEXT:")
        print(body_text[:3000])
        await page.screenshot(path="/work/outputs/member_ticket_20261010_055158/screenshots/explore_home.png")
        await browser.close()

asyncio.run(main())
PY
