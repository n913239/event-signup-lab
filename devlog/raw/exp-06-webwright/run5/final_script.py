"""Final script: Reserve 1 seat at 秋季音樂會 using general ticket, verify in 我的票券."""

import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

RUN_DIR = Path(__file__).parent.absolute()
SCREENSHOTS = RUN_DIR / "screenshots"
LOG = RUN_DIR / "final_script_log.txt"

SCREENSHOTS.mkdir(parents=True, exist_ok=True)
LOG.write_text("")


def log(step: int, msg: str) -> None:
    line = f"step {step} action: {msg}\n"
    LOG.open("a").write(line)
    print(line, end="")


async def main():
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(channel="chrome", headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        # ---------- Step 1: Login ----------
        await page.goto("http://localhost:5173", wait_until="domcontentloaded")
        await page.screenshot(path=str(SCREENSHOTS / "final_execution_1_open_login.png"))
        log(1, "open login page")

        await page.fill('input[name="email"]', 'member@example.com')
        await page.fill('input[type="password"]', 'password123')
        log(2, "fill login credentials (member@example.com / password123)")

        await page.click('button:has-text("登入")')
        await asyncio.sleep(3)

        await page.screenshot(path=str(SCREENSHOTS / "final_execution_2_after_login.png"))
        log(3, f"logged in — URL: {page.url}")

        # ---------- Step 2: Navigate to 秋季音樂會 (and handle existing hold) ----------
        await page.goto("http://localhost:5173/#/events/ev-1", wait_until="domcontentloaded")
        await asyncio.sleep(2)

        current_url = page.url
        
        # If redirected to /hold (existing reservation), abandon it first
        if '/hold' in current_url:
            log(3.5, f"existing hold found at {current_url}, clearing it first")
            # Get existing reservation info for debugging
            hold_heading = ''
            paras_locator = page.locator('main p')
            for i in range(await paras_locator.count()):
                hold_heading = await paras_locator.nth(i).inner_text()

            # Click 放棄 to clear the existing reservation
            abandon_btn = page.locator('button:has-text("放棄")')
            if await abandon_btn.count():
                await abandon_btn.click()
                await asyncio.sleep(2)
            log(4, f"after abandon — URL: {page.url}")

        # Now go back to event page (should have no /hold redirect)
        await page.goto("http://localhost:5173/#/events/ev-1", wait_until="domcontentloaded")
        await asyncio.sleep(2)

        await page.screenshot(path=str(SCREENSHOTS / "final_execution_3_event_detail.png"))
        log(5, f"event detail page — URL: {page.url}")

        # ---------- Step 3: Select general ticket type ----------
        await page.select_option('select', value='tt-general')
        await asyncio.sleep(1)

        opts = page.locator('select option')
        selected_idx = await page.locator('select').evaluate('(sel) => sel.selectedIndex')
        selected_ticket_text = await opts.nth(selected_idx).inner_text() if await opts.count() else ''
        log(6, f"selected ticket option: {selected_ticket_text}")

        # ---------- Step 4: Select seat B1 and reserve ----------
        await page.click('button[data-seat="B1"]')
        await asyncio.sleep(2)

        await page.screenshot(path=str(SCREENSHOTS / "final_execution_4_seat_selected.png"))
        log(7, "clicked seat B1 (selected → btn-primary)")

        # Click 保留 button
        hold_btn = page.locator('button:has-text("保留")')

        await hold_btn.click()
        await asyncio.sleep(3)

        await page.screenshot(path=str(SCREENSHOTS / "final_execution_5_reserved.png"))
        log(8, f"clicked 保留 — current URL: {page.url}")

        # ---------- Step 5: Extract hold page info (price, seat) ----------
        print(f"\n=== Hold/Confirmation Page ===")

        # Get heading (contains seat info: "秋季音樂會:保留 B1")
        headings = await page.locator('main h2').all()
        hold_heading_text = ''
        if headings:
            hold_heading_text = await headings[0].inner_text()
            log(9, f"  heading: {hold_heading_text}")

        # Get price info paragraphs
        paras = await page.locator('main p').all()
        price_text_parts = []
        for pa in paras:
            pt = await pa.inner_text()
            log(9, f"  paragraph: {pt}")
            price_text_parts.append(pt)

        # Extract ticket type from select (if still on event page / no redirect back)
        select_text = ''
        if await page.locator('select').count():
            opts2 = page.locator('select option')
            sidx = await page.locator('select').evaluate('(sel) => sel.selectedIndex')
            select_text = await opts2.nth(sidx).inner_text() if await opts2.count() else ''
        log(10, f"selected ticket option text: {select_text}")

        # Get buttons on hold page
        all_buttons = await page.locator('main button').all()
        button_texts = []
        for b in all_buttons:
            btext = await b.inner_text()
            if btext.strip():
                button_texts.append(btext)
        log(10, f"hold page buttons: {button_texts}")

        # ---------- Step 6: Confirm order (if on hold page) or go to my tickets directly ----------
        # On the hold page, there should be "確認" (confirm) and "放棄" buttons
        confirm_btn = page.locator('button:has-text("確認")')
        if await confirm_btn.count():
            log(11, "clicking 確認 on hold page")
            await confirm_btn.click()
            await asyncio.sleep(3)

        # After confirmation, page might redirect to tickets or stay
        await page.screenshot(path=str(SCREENSHOTS / "final_execution_6_after_confirm.png"))

        # ---------- Step 7: Navigate to 我的票券 (My Tickets) and verify ----------
        my_tickets_url = "http://localhost:5173/#/tickets"
        
        # Click 我的票券 link
        tickets_link = page.locator('a[href*="tickets"]')
        if await tickets_link.count():
            await tickets_link.click()

        try:
            await page.wait_for_url("**/tickets", timeout=5000)
        except Exception:
            pass
        
        await asyncio.sleep(2)

        # If already on tickets page (from confirmation redirect), screenshot
        await page.screenshot(path=str(SCREENSHOTS / "final_execution_7_my_tickets.png"))
        log(12, f"my tickets page — URL: {page.url}")

        # Extract ticket info from my tickets page
        main_elements = await page.locator('main').all()
        
        # Get all text content from main
        ticket_text_parts = []
        for m in main_elements:
            txt = await m.inner_text()
            if txt.strip():
                ticket_text_parts.append(txt)

        # Also try to find individual ticket cards/records  
        all_headings_on_tickets = await page.locator('main h2').all()
        ticket_headings = []
        for hd in all_headings_on_tickets:
            ticket_headings.append(await hd.inner_text())

        # Get paragraphs (price info on tickets page)
        ticket_paras = await page.locator('main p').all()
        ticket_para_texts = []
        for pa in ticket_paras:
            ticket_para_texts.append(await pa.inner_text())

        log(13, f"found {len(ticket_headings)} ticket heading(s)")
        for idx, hd in enumerate(ticket_headings):
            log(13, f"  ticket heading {idx}: {hd}")

        for idx, pt in enumerate(ticket_para_texts):
            log(13, f"  ticket paragraph {idx}: {pt}")

        # Full ARIA snapshot
        body_snap = await page.locator("body").aria_snapshot()

        # Compile full ticket text
        all_ticket_text = '\n'.join(ticket_text_parts)

        log(14, f"ticket text parts: {repr(all_ticket_text[:300])}")

        # Write final answer
        with LOG.open("a") as f:
            f.write(f"\nFINAL_ANSWER:\n  Seat: B1\n  Ticket type: {selected_ticket_text}\n  Hold page heading: {hold_heading_text}\n  Ticket page content: {repr(all_ticket_text[:300])}")

        print(f"\n=== FINAL ANSWER ===")
        print(f"Seat: B1")
        print(f"Ticket type: {selected_ticket_text}")
        if hold_heading_text:
            print(f"Hold page heading: {hold_heading_text}")

        # Print paragraph info for order amount
        for pt in price_text_parts:
            print(f"  Hold page info: {pt}")

        for pt in ticket_para_texts:
            print(f"  Ticket page info: {pt}")

        # Full tickets content
        print(f"\n=== My Tickets Page Content ===")
        for pt in ticket_text_parts:
            print(f"  {pt}")

        # ARIA snapshot for verification
        print(f"\n=== My Tickets Page ARIA Snapshot ===")
        print(body_snap)

        await browser.close()


asyncio.run(main())
