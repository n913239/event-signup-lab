"""
Final script: Book a General ticket for 秋季音樂會 on http://localhost:5173
as member@example.com, confirm order, check tickets page, verify NT$1,000 price.
"""
import asyncio, os
from pathlib import Path
from playwright.async_api import async_playwright

RUN_DIR = Path(__file__).parent
SCREENSHOTS = RUN_DIR / "screenshots"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)
LOG = RUN_DIR / "final_script_log.txt"
LOG.write_text("")  # reset


def log(step: int, msg: str) -> None:
    line = f"step {step} action: {msg}\n"
    LOG.open("a").write(line)
    print(line, end="")


async def ensure_login(page):
    """Log in as member@example.com if not already logged in."""
    body = await page.inner_text("body")
    if "登出" not in body:
        await page.goto("http://localhost:5173", wait_until="domcontentloaded")
        await page.fill('input[type="email"]', 'member@example.com')
        
        pw = page.locator('input[type="password"]')
        if await pw.count() == 0:
            pw = page.locator('textbox:has-text("密碼")')
        await pw.fill('password123')

        # Use the login button (not "註冊並登入")
        btn = page.locator('button[name="act"][value="login"]')
        await btn.click()

    await asyncio.sleep(1)  # wait for SPA routing


async def main():
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        # Step 1: Login
        log(1, "login as member@example.com")
        await ensure_login(page)
        await page.screenshot(path=str(SCREENSHOTS / "final_execution_1_login.png"))
        log(1, f"logged in, URL: {page.url}")

        # Step 2: Go to events list
        log(2, "navigate to events list")
        await page.click('a[href*="ev-1"]')  # Click 秋季音樂蓮 link
        await asyncio.sleep(2)
        await page.screenshot(path=str(SCREENSHOTS / "final_execution_2_events_list.png"))
        log(2, f"on event page, URL: {page.url}")

        # Step 3: Handle any existing holds (abandon first if needed)
        log(3, "check for existing seat hold")
        abandon_btn = page.locator('button:has-text("放棄")')
        
        if await abandon_btn.count():
            print("\n  Warning: There is an existing seat hold. Abandoning it...")
            await page.click('button:has-text("放棄")')
            print("  Existing hold abandoned.\n")
            await asyncio.sleep(1)

        # Step 4: Get price info from the ticket selection page
        log(4, "capture ticket pricing information")

        # Get all price info from body text
        body_text = await page.inner_text("body")

        # Find price strings in the content
        prices_found = []
        for line in body_text.split('\n'):
            if 'NT$' in line or '$' in line:
                prices_found.append(line.strip())

        # Get the select/combo box value for ticket type
        sel = page.locator('select')
        ticket_type_val = await sel.input_value() if await sel.count() else ""

        # ARIA snapshot for ticket options
        snapshot = await page.locator("body").aria_snapshot()

        # Capture the ticket type combobox text
        opt_selected = page.locator('select option[selected]')
        if await opt_selected.count():
            selected_text = await opt_selected.inner_text()
        else:
            # Try to get it from the aria snapshot  
            selected_text = ""

        await page.screenshot(path=str(SCREENSHOTS / "final_execution_3_ticket_selection.png"))

        # Step 5: Pick seat A1 (first available general ticket seat)
        log(5, "select seat A1 on General ticket type")
        
        # Click the first available seat (A1 through J10)
        await page.click('text="A1"')  # Select seat A1
        
        await asyncio.sleep(0.5)
        
        # The "保留" button should now be enabled (text says "保留 X 席")
        reserve_text = await page.locator('button:has-text("保留")').inner_text()
        log(5, f"clicked A1, reserve button: {reserve_text}")

        # Step 6: Click "保留" to go to confirmation page
        log(6, f"click reserve button ({reserve_text})")

        # Wait for the reservation to be made
        try:
            await page.click('button:has-text("保留")')
            await asyncio.sleep(2)
        except Exception as e:
            print(f"  Reservation error (seat might be held): {e}")

        await page.screenshot(path=str(SCREENSHOTS / "final_execution_4_confirmation.png"))

        # Step 7: Capture confirmation page price info
        log(7, "capture confirmation page prices")

        confirm_body = await page.inner_text("body")
        
        # Find all price strings on confirmation page  
        confirm_prices = []
        for line in confirm_body.split('\n'):
            if 'NT$' in line:
                confirm_prices.append(line.strip())

        # Click "確認" to finalize order  
        log(7, f"final confirmation - prices shown: {confirm_prices}")

        try:
            await page.click('button:has-text("確認")')
            print("  Order confirmed successfully.\n")
        except Exception as e:
            print(f"  Confirmation error: {e}")

        await asyncio.sleep(2)

        # Step 8: Navigate to "我的票券" (my tickets)
        log(8, "navigate to 我的票券 page")

        # The app might have redirected us somewhere after confirmation
        await asyncio.sleep(1)  # Wait for any SPA routing

        if "tickets" not in page.url:
            await page.click('a[href="#/tickets"]')
        else:
            log(8, f"already on tickets page: {page.url}")

        await asyncio.sleep(2)
        await page.screenshot(path=str(SCREENSHOTS / "final_execution_5_my_tickets.png"))

        # Step 9: Extract ticket info and verify price
        log(9, "verify ticket price on my tickets page")

        # Get full snapshot of the tickets page
        tickets_snapshot = await page.locator("body").aria_snapshot()

        # Find price strings on the tickets page
        ticket_body = await page.inner_text("body")
        ticket_prices = []
        for line in ticket_body.split('\n'):
            if 'NT$' in line or '$' in line:
                ticket_prices.append(line.strip())

        # Extract seat number from heading (e.g. "秋季音樂蓮:保留 A1")
        headings = page.locator('heading')
        if await headings.count():
            heading_text = await headings.first.inner_text()
        else:
            heading_text = "No heading found"

        # Also try to find the order/ticket details in the ARIA snapshot
        ticket_count = tickets_snapshot.count("票")

        log(9, f"tickets page - heading: {heading_text}, prices: {ticket_prices}")

        # Print all collected info
        print("\n" + "=" * 60)
        print("FINAL REPORT")
        print("=" * 60)
        
        # Print price info from each page
        print(f"\n--- Ticket Selection Page ---")
        print(f"  Default ticket type: {ticket_type_val}")
        print(f"  Prices found: {prices_found}")

        print(f"\n--- Confirmation Page ---")
        print(f"  Prices shown: {confirm_prices}")

        print(f"\n--- My Tickets Page ---")
        print(f"  Heading: {heading_text}")
        print(f"  Prices on tickets page: {ticket_prices}")

        # Check CP6: Is "一般" price NT$1,000 anywhere on the site?
        expected_price = "NT$1,000"
        actual_price = confirm_prices[0] if confirm_prices else "no price found"

        all_prices = prices_found + confirm_prices + ticket_prices
        print(f"\n--- Price Verification ---")
        print(f"  Expected (from task spec, DB: 100000 cents): {expected_price}")
        print(f"  Actual on site: {all_prices if all_prices else 'NO PRICES FOUND'}")

        price_matches = any(expected_price in p for p in all_prices)
        
        print(f"\n  NT$1,000 found anywhere: {price_matches}")

        if not price_matches and all_prices:
            print(f"  FAIL: No place shows NT$1,000. First price seen: {all_prices[0]}")
        elif all_prices:
            print(f"  PASS: Price matches expected NT$1,000")

        # Final response
        final_info = f"Ticket: {heading_text}, Prices seen: {all_prices}"
        
        with LOG.open("a") as f:
            f.write(f"\nFINAL_RESPONSE: {final_info}\n")

        print(f"\n  FINAL: {final_info}")

        await browser.close()


asyncio.run(main())
