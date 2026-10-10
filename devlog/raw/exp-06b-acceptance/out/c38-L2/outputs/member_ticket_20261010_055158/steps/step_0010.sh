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
        await page.get_by_text("秋季音樂會").first.click()
        await asyncio.sleep(1.5)
        # Select 一般 ticket type explicitly (already default selected, but set it to be safe)
        await page.get_by_role("combobox").select_option(label="一般・NT$10,000・剩 60")
        await asyncio.sleep(0.5)
        # Click seat A1
        await page.get_by_role("button", name="A1", exact=True).click()
        await asyncio.sleep(1.0)
        print("URL after seat click:", page.url)
        body_text = await page.evaluate("() => document.body.innerText")
        print("BODY TEXT:")
        print(body_text[:2500])
        snap = await page.locator("body").aria_snapshot()
        print("ARIA (tail):")
        print(snap[-1500:])
        await page.screenshot(path="/work/outputs/member_ticket_20261010_055158/screenshots/explore_seat_selected.png")
        await browser.close()

asyncio.run(main())
PY
