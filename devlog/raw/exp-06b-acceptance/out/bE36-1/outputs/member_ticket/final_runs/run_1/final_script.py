"""Webwright final script — member ticket reservation flow."""

import asyncio, os
from pathlib import Path
from playwright.async_api import async_playwright

RUN_DIR = Path(__file__).parent
SCREENSHOTS = RUN_DIR / "screenshots"
LOG = RUN_DIR / "final_script_log.txt"

SCREENSHOTS.mkdir(parents=True, exist_ok=True)
LOG.write_text("")  # reset log

def log(step: int, msg: str) -> None:
    line = f"step {step} action: {msg}\n"
    LOG.open("a").write(line)
    print(line, end="")


async def extract_prices(page) -> list[str]:
    """Find all NT$ amount strings in the page body text."""
    body = await page.locator("body").text_content()
    import re
    # Find all NT$X,XXX patterns (and their variants)
    amounts = re.findall(r'NT\$\d[\d,]*', body)
    return amounts


async def main() -> None:
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        # ── CP1: Login as member@example.com / password123 ───────────────
        log(1, "Navigate to http://localhost:5173 and login as member@example.com / password123")
        await page.goto("http://localhost:5173", timeout=10000)
        await page.fill('input[name="email"]', 'member@example.com')
        await page.fill('input[name="password"]', 'password123')
        submit_btn = page.get_by_role('button', name='登入').first
        await submit_btn.click(timeout=10000)
        await asyncio.sleep(2)
        await page.screenshot(path=str(SCREENSHOTS / "final_execution_1_login.png"))
        log(1, f"Logged in successfully — URL: {page.url}")

        # ── CP2: Enter 秋季音樂會 from events list ───────────────────────
        log(2, "Click the 秋季音樂會 event link from events list")
        await page.click('a[href*="/events/ev-1"]', timeout=10000)
        await asyncio.sleep(3)

        # The SPA redirects to /hold because an old hold exists from explorations.
        # We need to cancel it first before making a new reservation.
        current_url = page.url

        prices_on_hold = []  # default: no hold page to check

        if "/hold" in page.url:
            log(2, "Event page redirected to /hold (old hold exists) — cancelling with 放棄")
            await page.screenshot(path=str(SCREENSHOTS / "final_execution_2_old_hold.png"))
            
            # Extract prices on the old hold page (CP5)
            prices_on_hold = await extract_prices(page)
            log(2, f"Prices found on /hold page: {prices_on_hold}")

            # Cancel the hold
            await page.click('button:has-text("放棄")', timeout=10000)
            await asyncio.sleep(2)

        # Now we should be back on the seat-selection page (/events/ev-1)
        log(2, f"Back at event page — URL: {page.url}")

        await page.screenshot(path=str(SCREENSHOTS / "final_execution_2_event_page.png"))
        snap = await page.locator("body").aria_snapshot()

        # Extract prices from the event page (combobox options show ticket prices)
        prices_on_event = await extract_prices(page)
        log(2, f"Prices found on event page: {prices_on_event}")

        # Check which ticket type is selected
        cb = page.locator("combobox")
        if await cb.count() > 0:
            sel_opt = await cb.locator("option[selected]").first.text_content() or ""
            log(2, f"Selected ticket type: {sel_opt}")

        # ── CP3: Select "一般" ticket (default) and pick a seat, reserve 1 ──
        log(3, "Select seat A1 and click '保留'")

        # Seat A1 was already confirmed in prior exploration runs — try it, fall back to B1
        await page.locator("button[data-seat='A1']").click(timeout=3000)
        await asyncio.sleep(2)

        # Check if A1 click actually changed the submit button (SPA may silently ignore rebooking)
        submit_btn = page.locator('button:has-text("保留")').first
        submit_text_after_a1 = await submit_btn.text_content() or ''

        if '0 席' in submit_text_after_a1:
            # A1 click was silently ignored (seat already confirmed)
            log(3, "Seat A1 already confirmed — falling back to seat B1")
            await page.locator("button[data-seat='B1']").click(timeout=3000)
            await asyncio.sleep(2)
        else:
            log(3, f"Seat A1 selected — submit now reads: {submit_text_after_a1}")

        # The "保留" button should now show "保留 1 席" (enabled)
        await page.locator('button:has-text("保留")').first.click(timeout=10000)
        await asyncio.sleep(2)

        # We should now be on the /hold confirmation page
        log(3, f"Reached hold confirmation — URL: {page.url}")

        await page.screenshot(path=str(SCREENSHOTS / "final_execution_3_hold_confirm.png"))

        # Extract all price strings from the hold confirmation page (CP5)
        prices_on_confirm = await extract_prices(page)
        log(3, f"Prices found on hold confirmation page: {prices_on_confirm}")

        # Get the full text of this page for reporting
        body_text = await page.locator("body").text_content()
        log(3, f"Hold page text: {body_text[:500]}")

        # ── CP4: Confirm order by clicking "確認" ───────────────────────
        log(4, 'Click "確認" to finalize the order')
        await page.click('button:has-text("確認")', timeout=10000)
        await asyncio.sleep(3)

        log(4, f"Order confirmed — URL: {page.url}")
        await page.screenshot(path=str(SCREENSHOTS / "final_execution_4_order_confirmed.png"))

        # Capture prices on the post-order page
        prices_on_post = await extract_prices(page)
        log(4, f"Prices found on order confirmation page: {prices_on_post}")

        # Also capture ARIA for the order success state
        post_snap = await page.locator("body").aria_snapshot()
        log(4, f"Post-order ARIA:\n{post_snap[:3000]}")

        # ── CP5: Check price is NT$1,000 everywhere (expect failure if NT$10,000) ──
        log(5, "Check all prices — expected NT$1,000 for 一般 ticket")

        # Collect ALL amounts seen across all pages
        all_prices = list(prices_on_hold) + prices_on_event + prices_on_confirm + prices_on_post
        # Unique amounts (for reporting)
        import re
        all_amounts = set(re.findall(r'NT\$\d[\d,]*', '\n'.join(all_prices)))

        log(5, f"All price amounts seen across all pages: {all_amounts}")
        
        if all_amounts == {"NT$1,000"} or "NT$1,000" in all_amounts and all(a == "NT$1,000" for a in all_amounts):
            log(5, "PASS: All prices are NT$1,000")
        else:
            log(5, f"FAIL: Prices found are NOT NT$1,000 — the following amounts were seen on pages:")
            if prices_on_hold:
                log(5, f"  /hold (old): {prices_on_hold}")
            if prices_on_event:
                log(5, f"  events page (combobox options): {prices_on_event}")
            if prices_on_confirm:
                log(5, f"  /hold confirmation page: {prices_on_confirm}")
            if prices_on_post:
                log(5, f"  post-order page: {prices_on_post}")

        # ── CP6: Go to "我的票券" and verify ticket ─────────────────────
        log(6, 'Navigate to "我的票券" (tickets) page')
        await page.click('a[href*="/tickets"]', timeout=10000)
        await asyncio.sleep(2)

        log(6, f"Tickets page URL: {page.url}")
        await page.screenshot(path=str(SCREENSHOTS / "final_execution_5_tickets_page.png"))

        # Extract price info from tickets page
        prices_on_tickets = await extract_prices(page)
        log(6, f"Prices on tickets page: {prices_on_tickets}")

        # Full ARIA snapshot for verification
        ticket_snap = await page.locator("body").aria_snapshot()
        log(6, f"Tickets page ARIA:\n{ticket_snap[:5000]}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
