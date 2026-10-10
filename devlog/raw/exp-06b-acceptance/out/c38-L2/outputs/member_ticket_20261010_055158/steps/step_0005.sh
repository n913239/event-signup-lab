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
        await page.get_by_role("button", name="登入").click()
        await asyncio.sleep(1.5)
        print("URL after login:", page.url)
        body_text = await page.evaluate("() => document.body.innerText")
        print("BODY TEXT:")
        print(body_text[:3000])
        await page.screenshot(path="/work/outputs/member_ticket_20261010_055158/screenshots/explore_after_login.png")
        await browser.close()

asyncio.run(main())
PY
