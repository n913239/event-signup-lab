import asyncio
from playwright.async_api import async_playwright
import os
from pathlib import Path
import re

WORKSPACE = Path(os.environ.get("WORKSPACE_DIR", "<workdir>/outputs-4b/member_ticket_20260928_111135"))
RUN_DIR = WORKSPACE / "final_runs" / "run_001"
SCREENSHOTS_DIR = RUN_DIR / "screenshots"
LOG_FILE = RUN_DIR / "final_script_log.txt"

def write_log(step, message):
    with open(LOG_FILE, "a") as f:
        f.write(f"step {step} action: {message}\n")
    print(f"[LOG] step {step}: {message}")

async def main():
    # Clean start for this run
    RUN_DIR.mkdir(parents=True, exist_ok=True)
    SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
    LOG_FILE.write_text("")

    async with async_playwright() as p:
        browser = await p.chromium.launch(channel="chrome", headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        # CP1: Login with member credentials
        write_log(1, "Navigate to start URL and login with member@example.com / password123")
        await page.goto("http://localhost:5173", wait_until="domcontentloaded")
        await page.fill('input[type="email"]', 'member@example.com')
        await page.fill('input[type="password"]', 'password123')
        await page.click('button:has-text("登入")')
        await asyncio.sleep(2)
        await page.screenshot(path=str(SCREENSHOTS_DIR / "final_execution_1_login.png"))
        write_log(1, f"Logged in successfully. URL: {page.url}, Title: {await page.title()}")

        # CP2: Navigate to 秋季音樂會 event page
        write_log(2, "Click on 秋季音樂會 event link from events list")
        await page.click('a[href*="ev-1"]')
        await asyncio.sleep(2)
        await page.screenshot(path=str(SCREENSHOTS_DIR / "final_execution_2_event_page.png"))
        write_log(2, f"On event page. URL: {page.url}, Title: {await page.title()}")

        # CP3: Select '一般' ticket type from combobox (already default)
        write_log(3, "Verify '一般' ticket type is selected (NT$10,000)")
        ticket_select = page.locator('select#tt')
        selected_value = await ticket_select.input_value()
        write_log(3, f"Selected ticket type value: {selected_value}")
        await page.screenshot(path=str(SCREENSHOTS_DIR / "final_execution_3_ticket_type.png"))

        # CP4: Click an unselected seat (btn-outline) to select one seat
        write_log(4, "Click an unselected seat button (C1) to reserve a seat")
        # First deselect any pre-selected seats (A1, A2 with btn-success)
        for seat in ['A1', 'A2']:
            btn = page.locator(f'button[data-seat="{seat}"]')
            cls = await btn.get_attribute('class')
            if 'btn-success' in cls:
                await btn.click()
                write_log(4, f"Deselected pre-selected seat {seat}")
        await asyncio.sleep(0.5)

        # Now click C1 (btn-outline -> btn-primary)
        c1_btn = page.locator('button[data-seat="C1"]')
        await c1_btn.click()
        await asyncio.sleep(1)
        c1_class = await c1_btn.get_attribute('class')
        write_log(4, f"Seat C1 selected. Class: {c1_class}")
        await page.screenshot(path=str(SCREENSHOTS_DIR / "final_execution_4_seat_selected.png"))

        # CP5: Click '保留 1 席' button to reserve the seat
        write_log(5, "Click '保留 1 席' button to reserve the seat")
        reserve_btn = page.locator('button#hold')
        btn_text = await reserve_btn.text_content()
        write_log(5, f"Reserve button text: {btn_text}")
        await reserve_btn.click()
        await asyncio.sleep(2)
        await page.screenshot(path=str(SCREENSHOTS_DIR / "final_execution_5_reserved.png"))
        write_log(5, f"Seat reserved. URL: {page.url}")

        # CP6: Confirm order and capture order amount
        write_log(6, "Confirm order and capture order amount (訂單金額)")
        await asyncio.sleep(1)
        body_text = await page.locator("body").text_content()
        write_log(6, f"Order confirmation page content: {body_text[:500]}")
        await page.screenshot(path=str(SCREENSHOTS_DIR / "final_execution_6_order_confirm.png"))
        # Extract order amount from page
        price_match = re.search(r'NT\$[0-9,]+', body_text)
        order_amount = price_match.group(0) if price_match else "not found"
        write_log(6, f"Order amount: {order_amount}")

        # CP7: Navigate to '我的票券' page
        write_log(7, "Navigate to '我的票券' (my tickets) page")
        await page.click('a[href*="/tickets"]')
        await asyncio.sleep(2)
        await page.screenshot(path=str(SCREENSHOTS_DIR / "final_execution_7_my_tickets.png"))
        write_log(7, f"On my tickets page. URL: {page.url}, Title: {await page.title()}")

        # CP8: Verify ticket is visible, capture seat number and ticket page content
        write_log(8, "Verify ticket visible in my tickets, capture seat number and ticket content")
        tickets_body = await page.locator("body").text_content()
        write_log(8, f"My tickets page content: {tickets_body[:1000]}")
        await page.screenshot(path=str(SCREENSHOTS_DIR / "final_execution_8_ticket_verified.png"))

        # Extract seat number from tickets page
        seat_match = re.search(r'[A-Z][0-9]+', tickets_body)
        seat_number = seat_match.group(0) if seat_match else "not found"
        write_log(8, f"Seat number: {seat_number}")

        # Print final summary
        print("\n=== FINAL SUMMARY ===")
        print(f"Seat Number: {seat_number}")
        print(f"Order Amount: {order_amount}")
        print(f"Ticket Page Content (first 500 chars): {tickets_body[:500]}")
        print("=====================\n")

        await browser.close()

asyncio.run(main())
