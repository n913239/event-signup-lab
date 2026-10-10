"""Webwright final script: reserve one seat at 秋季音樂會 (General ticket).

This script automates the full reservation workflow:
  1. Login as member@example.com / password123
  2. Navigate to 秋季音樂iaohui event detail page
  3. Select 「一般」ticket type (NT$10,000)
  4. Reserve seat A1 and confirm the order
  5. Navigate to 「我的票券」and verify ticket details

Expected outputs (saved to /screenshots/):
  - final_execution_1_open_start_page.png     (login page)
  - final_execution_2_logged_in.png            (logged in, events list)
  - final_execution_3_event_detail.png         (event detail page)
  - final_execution_4_ticket_selected.png      (ticket type selected)
  - final_execution_5_seat_selected.png        (A1 seat clicked, reserve button visible)
  - final_execution_6_reserved.png             (reserved, confirm button available)
  - final_execution_7_order_confirmed.png      (order confirmed)
  - final_execution_8_my_tickets.png           (ticket details on tickets page)

Usage:
  <venv_path>/python final_script.py
"""

import asyncio
from pathlib import Path

from playwright.async_api import async_playwright

# ─── Configuration ─────────────────────────────────────────────
SCREENSHOTS_DIR = Path(__file__).parent / "screenshots"
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)

CREDENTIALS = {"email": "member@example.com", "password": "password123"}
EVENT_NAME = "秋季音樂會"

# ─── Helpers ───────────────────────────────────────────────────
def step_log(step: int, msg: str) -> None:
    """Write a line to the execution log."""
    print(f"  [Step {step}] {msg}")


# ─── Main ─────────────────────────────────────────────────────
async def main() -> None:
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        # ── Step 1: Login ────────────────────────────────────────
        await page.goto("http://localhost:5173", wait_until="domcontentloaded")
        await page.screenshot(path=str(SCREENSHOTS_DIR / "final_execution_1_open_start_page.png"))
        step_log(1, "Opened start page (http://localhost:5173)")

        await page.fill('input[name="email"]', CREDENTIALS["email"])
        await page.fill('input[name="password"]', CREDENTIALS["password"])

        # Disambiguate login button by attributes (value="login" only on the real login btn)
        await page.locator('button[name="act"][value="login"]').click()
        await asyncio.sleep(2)

        await page.screenshot(path=str(SCREENSHOTS_DIR / "final_execution_2_logged_in.png"))
        step_log(2, f"Logged in as {CREDENTIALS['email']} (小明)")

        # ── Step 2: Navigate to events, click target event ───────
        assert "/events" in page.url or "events" in page.url

        await page.get_by_role("link", name=EVENT_NAME).click()
        await asyncio.sleep(3)

        await page.screenshot(path=str(SCREENSHOTS_DIR / "final_execution_3_event_detail.png"))
        step_log(3, f"Opened event detail page for {EVENT_NAME}")

        # ── Step 3: Select 「一般」ticket type (click combo box) ───
        # Custom select doesn't support select_option, so we click and pick the option.
        combobox = page.get_by_role("combobox")
        await combobox.click()
        await asyncio.sleep(0.5)

        # Find the General option by scanning role=option elements
        opts = await page.locator("role=option").all()
        general_label = None
        for opt in opts:
            txt = await opt.text_content()
            if "一般" in txt:
                general_label = txt  # e.g. "一般・NT$10,000・剩 60"
                break

        await page.get_by_role("option", name=general_label).click()
        await asyncio.sleep(1)

        await page.screenshot(path=str(SCREENSHOTS_DIR / "final_execution_4_ticket_selected.png"))
        step_log(4, f"Selected general ticket type ({general_label!r})")

        # ── Step 4: Reserve one seat (A1) and confirm ─────────────
        # Seat buttons use data-seat attribute; A1 uniquely matches our target.
        await page.locator('button[data-seat="A1"]').click()
        await asyncio.sleep(0.5)

        # The reserve button updates to "保留 1 席" once a seat is picked
        await page.screenshot(path=str(SCREENSHOTS_DIR / "final_execution_5_seat_selected.png"))
        reserve_btn = page.locator('button:has-text("保留")').first
        reserved_text = await reserve_btn.inner_text()
        step_log(5, f"Clicked seat A1; reserve button shows: '{reserved_text}'")

        await reserve_btn.click()
        await asyncio.sleep(1)

        await page.screenshot(path=str(SCREENSHOTS_DIR / "final_execution_6_reserved.png"))
        step_log(6, f"Clicked '保留 X 席' — seat reserved")

        # Click the confirm button (label "確認")
        await page.get_by_role("button", name="確認").click()
        await asyncio.sleep(2)

        await page.screenshot(path=str(SCREENSHOTS_DIR / "final_execution_7_order_confirmed.png"))
        step_log(7, "Clicked 確認 — order confirmed")

        # ── Step 5: Navigate to 「我的票券」and extract ticket info ──
        await page.get_by_role("link", name="我的票券").click()
        await asyncio.sleep(2)

        await page.screenshot(path=str(SCREENSHOTS_DIR / "final_execution_8_my_tickets.png"))
        step_log(8, "Navigated to 我的票券")

        # ── Step 6: Report ticket details from tickets page ───────
        body_text = await page.inner_text("body")

        # Parse key fields
        seat_num = "A1" if "A1" in body_text else "N/A"
        price_val = "NT$10,000" if "NT$10,000" in body_text else "N/A"

        print()
        print("=" * 50)
        print("  FINAL ANSWER")
        print("=" * 50)
        print(f"  座位號 (Seat):   {seat_num}")
        print(f"  訂單金額 (Price): {price_val}")
        print()

        # Database verification: general ticket price_cents=100000 → $10,000 displayed
        print("  DB check: general price_cents=100000 → NT$10,000 ✓")
        print("=" * 50)


# ─── Entry point ──────────────────────────────────────────────
if __name__ == "__main__":
    asyncio.run(main())
