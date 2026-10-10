python - <<'PY'
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 1800})
        await page.goto("http://localhost:5173/#/login", wait_until="networkidle")
        await page.get_by_role("textbox", name="email").fill("member@example.com")
        await page.get_by_role("textbox", name="密碼(至少 8 字元)").fill("password123")
        await page.get_by_role("button", name="登入", exact=True).click()
        await asyncio.sleep(1.5)
        # Click on the 秋季音樂會 event
        await page.get_by_text("秋季音樂會").first.click()
        await asyncio.sleep(1.5)
        print("URL after event click:", page.url)
        body_text = await page.evaluate("() => document.body.innerText")
        print("BODY TEXT:")
        print(body_text[:4000])
        snap = await page.locator("body").aria_snapshot()
        print("ARIA:")
        print(snap)
        await page.screenshot(path="/work/outputs/member_ticket_20261010_055158/screenshots/explore_event_detail.png")
        await browser.close()

asyncio.run(main())
PY
