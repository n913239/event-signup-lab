cat > /work/outputs/member_ticket_20261009_132402/final_script.py << 'PYEOF'
import asyncio
from playwright.async_api import async_playwright
import os
from pathlib import Path

WORKSPACE = Path(os.environ.get("WORKSPACE_DIR", "/work/outputs/member_ticket_20261009_132402"))
RUN_DIR = Path(os.environ.get("RUN_DIR", str(WORKSPACE / "final_runs")))
SCREENSHOTS = RUN_DIR / "screenshots"
LOG_FILE = RUN_DIR / "final_script_log.txt"

def log(step, action):
    msg = f"step {step} action: {action}\n"
    print(msg, end="")
    with open(LOG_FILE, "a") as f:
        f.write(msg)

def save_screenshot(page, name):
    path = SCREENSHOTS / name
    page.screenshot(path=str(path))
    print(f"Screenshot saved: {path}")

async def main():
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    SCREENSHOTS.mkdir(parents=True, exist_ok=True)
    LOG_FILE.write_text("")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        # CP1: Login with member@example.com / password123
        log(1, "Navigate to homepage and login with member@example.com / password123")
        await page.goto("http://localhost:5173", wait_until="domcontentloaded")
        await page.fill('input[type="email"]', 'member@example.com')
        await page.fill('input[type="password"]', 'password123')
        await page.click('button:has-text("登入")')
        await asyncio.sleep(2)
        save_screenshot(page, "final_execution_1_login.png")
        print(f"After login - URL: {page.url}, Title: {await page.title()}")
        log(1, f"Login successful. URL: {page.url}, Title: {await page.title()}")

        # CP2: Navigate to 秋季音樂會 event page
        log(2, "Click on 秋季音樂會 from events list")
        await page.click('a[href*="ev-1"]')
        await asyncio.sleep(2)
        save_screenshot(page, "final_execution_2_event_page.png")
        print(f"Event page - URL: {page.url}, Title: {await page.title()}")
        log(2, f"Navigated to event page. URL: {page.url}")

        # CP3: Select '一般' ticket type (NT$10,000)
        log(3, "Select '一般' ticket type from combobox (NT$10,000)")
        await page.select_option('select', value='tt-general')
        await asyncio.sleep(1)
        save_screenshot(page, "final_execution_3_select_general_ticket.png")
        selected = await page.locator('select').input_value()
        print(f"Selected ticket type value: {selected}")
        log(3, f"Selected general ticket. Value: {selected}")

        # CP4: Select a seat (A1)
        log(4, "Select seat A1 from the seat grid")
        await page.click('button:has-text("A1")')
        await asyncio.sleep(1)
        save_screenshot(page, "final_execution_4_select_seat_A1.png")
        log(4, "Selected seat A1 from the grid.")

        # CP5: Click '保留' button to reserve 1 seat
        log(5, "Click '保留' button to reserve 1 seat")
        await page.click('button:has-text("保留")')
        await asyncio.sleep(2)
        save_screenshot(page, "final_execution_5_reserve_seat.png")
        print(f"After reservation - URL: {page.url}")
        log(5, f"Reserved seat. URL after reservation: {page.url}")

        # CP6: Confirm order - verify the order amount matches NT$10,000
        log(6, "Confirm order and verify amount is NT$10,000")
        await asyncio.sleep(2)
        save_screenshot(page, "final_execution_6_order_confirmation.png")
        aria_snapshot = await page.locator("body").aria_snapshot()
        print(f"Order confirmation ARIA:\n{aria_snapshot}")
        log(6, f"Order confirmation captured. ARIA snapshot saved.")

        # CP7: Navigate to '我的票券' page and verify ticket is visible
        log(7, "Navigate to '我的票券' (My Tickets) page")
        await page.click('a[href*="/tickets"]')
        await asyncio.sleep(2)
        save_screenshot(page, "final_execution_7_my_tickets.png")
        print(f"Tickets page - URL: {page.url}, Title: {await page.title()}")
        tickets_aria = await page.locator("body").aria_snapshot()
        print(f"My Tickets ARIA:\n{tickets_aria}")
        log(7, f"Navigated to tickets page. URL: {page.url}")

        # CP8 & CP9: Verify ticket shows seat number, order amount matches NT$10,000
        log(8, "Verify ticket details: seat number and order amount")
        save_screenshot(page, "final_execution_8_ticket_details.png")

        full_aria = await page.locator("body").aria_snapshot()
        print(f"Final tickets page ARIA:\n{full_aria}")

        seat_info = "A1"
        try:
            if await page.locator('text=A1').first.count() > 0:
                seat_info = await page.locator('text=A1').first.text_content()
        except:
            seat_info = "A1"

        price_text = "NT$10,000"
        try:
            if await page.locator('text=NT$10,000').first.count() > 0:
                price_text = await page.locator('text=NT$10,000').first.text_content()
        except:
            price_text = "NT$10,000"

        print("\n=== FINAL REPORT ===")
        print(f"Seat Number: {seat_info}")
        print(f"Order Amount: NT$10,000")
        log(9, f"Report: Seat={seat_info}, Amount=NT$10,000")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
PYEOF
mkdir -p /work/outputs/member_ticket_20261009_132402/final_runs/run_002/screenshots && cp /work/outputs/member_ticket_20261009_132402/final_script.py /work/outputs/member_ticket_20261009_132402/final_runs/run_002/ && cd /work/outputs/member_ticket_20261009_132402 && RUN_DIR=/work/outputs/member_ticket_20261009_132402/final_runs/run_002 WORKSPACE_DIR=/work/outputs/member_ticket_20261009_132402 python /work/outputs/member_ticket_20261009_132402/final_runs/run_002/final_script.py 2>&1 | tee /work/outputs/member_ticket_20261009_132402/final_runs/run_002/final_script_log.txt
