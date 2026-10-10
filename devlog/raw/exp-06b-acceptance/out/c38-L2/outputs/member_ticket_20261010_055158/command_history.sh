# Step 1
cd /work/outputs/member_ticket_20261010_055158 && ls -la && echo '---TASK.JSON---' && cat task.json 2>/dev/null | head -50

# Step 2
cat <lab>/seed.sql 2>/dev/null | head -5; echo '---'; ls <lab>/ 2>/dev/null; echo '---FIND---'; find / -name 'seed.sql' 2>/dev/null | head -5

# Step 3
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

# Step 4
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

# Step 5
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

# Step 6
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
        print("URL after login:", page.url)
        body_text = await page.evaluate("() => document.body.innerText")
        print("BODY TEXT:")
        print(body_text[:3000])
        await page.screenshot(path="/work/outputs/member_ticket_20261010_055158/screenshots/explore_after_login.png")
        await browser.close()

asyncio.run(main())
PY

# Step 7
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

# Step 8
grep -n '一般\|VIP\|price\|ticket' <lab>/seed.sql | head -30

# Step 9
grep -rn 'price_cents\|NT$\|toLocaleString\|/ 10\|/10' <lab>/web/src 2>/dev/null | head -30

# Step 10
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

# Step 11
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
        # Select 一般 ticket type explicitly
        await page.get_by_role("combobox").select_option(label="一般・NT$10,000・剩 60")
        await asyncio.sleep(0.5)
        # Click seat A1
        await page.get_by_role("button", name="A1", exact=True).click()
        await asyncio.sleep(0.8)
        # Click 保留 1 席
        await page.get_by_role("button", name="保留 1 席").click()
        await asyncio.sleep(2.0)
        print("URL after reserve:", page.url)
        body_text = await page.evaluate("() => document.body.innerText")
        print("BODY TEXT:")
        print(body_text[:3000])
        snap = await page.locator("body").aria_snapshot()
        print("ARIA:")
        print(snap)
        await page.screenshot(path="/work/outputs/member_ticket_20261010_055158/screenshots/explore_after_reserve.png")
        await browser.close()

asyncio.run(main())
PY

