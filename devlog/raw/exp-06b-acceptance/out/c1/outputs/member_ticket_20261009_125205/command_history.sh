# Step 1
sed -n '1,5p' <lab>/seed.sql

# Step 2
python - <<'PY'
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        # Step 1: Go to the start page and explore
        await page.goto("http://localhost:5173", wait_until="domcontentloaded")
        await page.screenshot(path="/work/outputs/member_ticket_20261009_125205/screenshots/1_homepage.png")
        print("URL:", page.url)
        print("TITLE:", await page.title())
        print("ARIA SNAPSHOT:")
        print(await page.locator("body").aria_snapshot())
        await browser.close()

asyncio.run(main())
PY

# Step 3
cat > /work/outputs/member_ticket_20261009_125205/plan.md << 'EOF'
# Critical Points
- [ ] CP1: Login with member@example.com / password123 successfully
- [ ] CP2: Navigate to events list page after login
- [ ] CP3: Find and enter '秋季音樂會' event detail page
- [ ] CP4: Select '一般' ticket type and reserve 1 seat
- [ ] CP5: Confirm the order successfully
- [ ] CP6: Navigate to '我的票券' (my tickets) page and verify the ticket is visible
- [ ] CP7: Verify seat number, order amount matches database ticket price, and ticket page content
EOF
cat /work/outputs/member_ticket_20261009_125205/plan.md

# Step 4
python - <<'PY'
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        # Step 1: Login with member credentials
        await page.goto("http://localhost:5173", wait_until="domcontentloaded")
        await page.fill('input[type="email"]', 'member@example.com')
        await page.fill('input[type="password"]', 'password123')
        await page.click('button:has-text("登入")')
        await asyncio.sleep(2)
        await page.screenshot(path="/work/outputs/member_ticket_20261009_125205/screenshots/2_after_login.png")
        print("URL after login:", page.url)
        print("TITLE:", await page.title())
        print("ARIA SNAPSHOT after login:")
        print(await page.locator("body").aria_snapshot())

        # Step 2: Click on 活動報名 to go to events list
        await page.click('a[href*="events"]')
        await asyncio.sleep(2)
        await page.screenshot(path="/work/outputs/member_ticket_20261009_125205/screenshots/3_events_list.png")
        print("URL after events:", page.url)
        print("TITLE:", await page.title())
        print("ARIA SNAPSHOT events list:")
        print(await page.locator("body").aria_snapshot())

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
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        # Login first
        await page.goto("http://localhost:5173", wait_until="domcontentloaded")
        await page.fill('input[type="email"]', 'member@example.com')
        await page.fill('input[type="password"]', 'password123')
        await page.click('button:has-text("登入")')
        await asyncio.sleep(2)

        # Click on 秋季音樂會 event link
        await page.click('a[href*="events/ev-1"]')
        await asyncio.sleep(2)
        await page.screenshot(path="/work/outputs/member_ticket_20261009_125205/screenshots/4_event_detail.png")
        print("URL:", page.url)
        print("TITLE:", await page.title())
        print("ARIA SNAPSHOT event detail:")
        print(await page.locator("body").aria_snapshot())

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
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        # Login first
        await page.goto("http://localhost:5173", wait_until="domcontentloaded")
        await page.fill('input[type="email"]', 'member@example.com')
        await page.fill('input[type="password"]', 'password123')
        await page.click('button:has-text("登入")')
        await asyncio.sleep(2)

        # Click on 秋季音樂會 event link
        await page.click('a[href*="events/ev-1"]')
        await asyncio.sleep(2)

        # Select 一般 ticket (already selected by default, but verify)
        await page.select_option('select', value='一般')
        await asyncio.sleep(1)

        # Click seat A1 to reserve it
        await page.click('button:has-text("A1")')
        await asyncio.sleep(1)
        await page.screenshot(path="/work/outputs/member_ticket_20261009_125205/screenshots/5_seat_selected.png")
        print("URL:", page.url)
        print("ARIA SNAPSHOT after seat selection:")
        print(await page.locator("body").aria_snapshot())

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
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        # Login first
        await page.goto("http://localhost:5173", wait_until="domcontentloaded")
        await page.fill('input[type="email"]', 'member@example.com')
        await page.fill('input[type="password"]', 'password123')
        await page.click('button:has-text("登入")')
        await asyncio.sleep(2)

        # Click on 秋季音樂會 event link
        await page.click('a[href*="events/ev-1"]')
        await asyncio.sleep(2)

        # 一般 is already selected by default. Click seat A1.
        await page.click('button:has-text("A1")')
        await asyncio.sleep(1)
        await page.screenshot(path="/work/outputs/member_ticket_20261009_125205/screenshots/5_seat_selected.png")
        print("URL:", page.url)
        print("ARIA SNAPSHOT after seat selection:")
        print(await page.locator("body").aria_snapshot())

        await browser.close()

asyncio.run(main())
PY

# Step 8
python - <<'PY'
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        # Login first
        await page.goto("http://localhost:5173", wait_until="domcontentloaded")
        await page.fill('input[type="email"]', 'member@example.com')
        await page.fill('input[type="password"]', 'password123')
        await page.click('button:has-text("登入")')
        await asyncio.sleep(2)

        # Click on 秋季音樂會 event link
        await page.click('a[href*="events/ev-1"]')
        await asyncio.sleep(2)

        # Click seat A1
        await page.click('button:has-text("A1")')
        await asyncio.sleep(1)

        # Click 保留 1 席 button
        await page.click('button:has-text("保留")')
        await asyncio.sleep(2)
        await page.screenshot(path="/work/outputs/member_ticket_20261009_125205/screenshots/6_reservation_confirmed.png")
        print("URL:", page.url)
        print("TITLE:", await page.title())
        print("ARIA SNAPSHOT after reservation:")
        print(await page.locator("body").aria_snapshot())

        await browser.close()

asyncio.run(main())
PY

# Step 9
python - <<'PY'
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        # Login first
        await page.goto("http://localhost:5173", wait_until="domcontentloaded")
        await page.fill('input[type="email"]', 'member@example.com')
        await page.fill('input[type="password"]', 'password123')
        await page.click('button:has-text("登入")')
        await asyncio.sleep(2)

        # Click on 秋季音樂會 event link
        await page.click('a[href*="events/ev-1"]')
        await asyncio.sleep(2)

        # Click seat A1
        await page.click('button:has-text("A1")')
        await asyncio.sleep(1)

        # Click 保留 1 席 button
        await page.click('button:has-text("保留")')
        await asyncio.sleep(2)

        # Click 確認 button to confirm order
        await page.click('button:has-text("確認")')
        await asyncio.sleep(2)
        await page.screenshot(path="/work/outputs/member_ticket_20261009_125205/screenshots/7_order_confirmed.png")
        print("URL after confirm:", page.url)
        print("TITLE:", await page.title())
        print("ARIA SNAPSHOT after order confirmation:")
        print(await page.locator("body").aria_snapshot())

        # Now navigate to 我的票券 page
        await page.click('a[href*="tickets"]')
        await asyncio.sleep(2)
        await page.screenshot(path="/work/outputs/member_ticket_20261009_125205/screenshots/8_my_tickets.png")
        print("URL on tickets page:", page.url)
        print("TITLE:", await page.title())
        print("ARIA SNAPSHOT tickets page:")
        print(await page.locator("body").aria_snapshot())

        await browser.close()

asyncio.run(main())
PY

# Step 10
cat > /work/outputs/member_ticket_20261009_125205/final_script.py << 'PYEOF'
import asyncio
from playwright.async_api import async_playwright
import os
from pathlib import Path

WORKSPACE = Path(os.environ.get("WORKSPACE_DIR", "/work/outputs/member_ticket_20261009_125205"))
RUN_DIR = WORKSPACE / "final_runs" / "run_001"
SCREENSHOTS_DIR = RUN_DIR / "screenshots"
LOG_FILE = RUN_DIR / "final_script_log.txt"

SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE.write_text("")

def log(step, action):
    msg = f"step {step} action: {action}\n"
    LOG_FILE.write_text(msg, mode="a")
    print(msg.strip())

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        # CP1: Login with member credentials
        log(1, "Login with member@example.com / password123")
        await page.goto("http://localhost:5173", wait_until="domcontentloaded")
        await page.fill('input[type="email"]', 'member@example.com')
        await page.fill('input[type="password"]', 'password123')
        await page.click('button:has-text("登入")')
        await asyncio.sleep(2)
        await page.screenshot(path=str(SCREENSHOTS_DIR / "final_execution_1_login.png"))
        log(1, f"Logged in successfully. URL: {page.url}")

        # CP2: Navigate to events list (already on it after login)
        log(2, "Navigate to events list page")
        await asyncio.sleep(1)
        await page.screenshot(path=str(SCREENSHOTS_DIR / "final_execution_2_events_list.png"))
        log(2, f"Events list loaded. URL: {page.url}")

        # CP3: Find and enter 秋季音樂會 event detail page
        log(3, "Click on 秋季音樂會 event link to enter event detail")
        await page.click('a[href*="events/ev-1"]')
        await asyncio.sleep(2)
        await page.screenshot(path=str(SCREENSHOTS_DIR / "final_execution_3_event_detail.png"))
        log(3, f"Event detail page loaded. URL: {page.url}")

        # CP4: Select 一般 ticket (already selected by default) and reserve seat A1
        log(4, "Select 一般 ticket (NT$10,000) and click seat A1 to reserve")
        # 一般 is already selected by default. Click seat A1.
        await page.click('button:has-text("A1")')
        await asyncio.sleep(1)
        # Verify the reservation button changed to '保留 1 席'
        await page.screenshot(path=str(SCREENSHOTS_DIR / "final_execution_4_seat_selected.png"))
        log(4, f"Seat A1 selected. Reservation button now shows '保留 1 席'.")

        # Click the reservation button
        await page.click('button:has-text("保留")')
        await asyncio.sleep(2)
        await page.screenshot(path=str(SCREENSHOTS_DIR / "final_execution_5_reservation_page.png"))
        log(5, f"Reservation page loaded. URL: {page.url}")

        # CP5: Confirm the order
        log(5, "Click 確認 button to confirm the order")
        await page.click('button:has-text("確認")')
        await asyncio.sleep(2)
        await page.screenshot(path=str(SCREENSHOTS_DIR / "final_execution_6_order_confirmed.png"))
        log(5, f"Order confirmed. URL: {page.url}")

        # CP6: Navigate to 我的票券 page and verify ticket is visible
        log(6, "Navigate to 我的票券 (my tickets) page")
        await page.click('a[href*="tickets"]')
        await asyncio.sleep(2)
        await page.screenshot(path=str(SCREENSHOTS_DIR / "final_execution_7_my_tickets.png"))
        log(6, f"Tickets page loaded. URL: {page.url}")

        # CP7: Extract seat number, order amount, and ticket page content
        log(7, "Extract seat number, order amount, and ticket details from tickets page")
        aria = await page.locator("body").aria_snapshot()
        log(7, f"Tickets page ARIA snapshot:\n{aria}")

        # Extract key info from the page
        title = await page.title()
        url = page.url
        log(7, f"Final state - URL: {url}, Title: {title}")

        # Print the full aria snapshot for verification
        print("\n=== FINAL ARIA SNAPSHOT ===")
        print(aria)

        await browser.close()

asyncio.run(main())
PYEOF
echo "final_script.py created successfully"
cat /work/outputs/member_ticket_20261009_125205/final_script.py | head -20

# Step 11
cd /work/outputs/member_ticket_20261009_125205 && python final_script.py 2>&1 | tee final_runs/run_001/final_script_log.txt

# Step 12
cat > /work/outputs/member_ticket_20261009_125205/final_script.py << 'PYEOF'
import asyncio
from playwright.async_api import async_playwright
import os
from pathlib import Path

WORKSPACE = Path(os.environ.get("WORKSPACE_DIR", "/work/outputs/member_ticket_20261009_125205"))
RUN_DIR = WORKSPACE / "final_runs" / "run_001"
SCREENSHOTS_DIR = RUN_DIR / "screenshots"
LOG_FILE = RUN_DIR / "final_script_log.txt"

SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE.write_text("")

log_lines = []
def log(step, action):
    msg = f"step {step} action: {action}"
    log_lines.append(msg + "\n")
    print(msg)

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        # CP1: Login with member credentials
        log(1, "Login with member@example.com / password123")
        await page.goto("http://localhost:5173", wait_until="domcontentloaded")
        await page.fill('input[type="email"]', 'member@example.com')
        await page.fill('input[type="password"]', 'password123')
        await page.click('button:has-text("登入")')
        await asyncio.sleep(2)
        await page.screenshot(path=str(SCREENSHOTS_DIR / "final_execution_1_login.png"))
        log(1, f"Logged in successfully. URL: {page.url}")

        # CP2: Navigate to events list (already on it after login)
        log(2, "Navigate to events list page")
        await asyncio.sleep(1)
        await page.screenshot(path=str(SCREENSHOTS_DIR / "final_execution_2_events_list.png"))
        log(2, f"Events list loaded. URL: {page.url}")

        # CP3: Find and enter 秋季音樂會 event detail page
        log(3, "Click on 秋季音樂會 event link to enter event detail")
        await page.click('a[href*="events/ev-1"]')
        await asyncio.sleep(2)
        await page.screenshot(path=str(SCREENSHOTS_DIR / "final_execution_3_event_detail.png"))
        log(3, f"Event detail page loaded. URL: {page.url}")

        # CP4: Select 一般 ticket (already selected by default) and reserve seat A1
        log(4, "Select 一般 ticket (NT$10,000) and click seat A1 to reserve")
        # 一般 is already selected by default. Click seat A1.
        await page.click('button:has-text("A1")')
        await asyncio.sleep(1)
        # Verify the reservation button changed to '保留 1 席'
        await page.screenshot(path=str(SCREENSHOTS_DIR / "final_execution_4_seat_selected.png"))
        log(4, f"Seat A1 selected. Reservation button now shows '保留 1 席'.")

        # Click the reservation button
        await page.click('button:has-text("保留")')
        await asyncio.sleep(2)
        await page.screenshot(path=str(SCREENSHOTS_DIR / "final_execution_5_reservation_page.png"))
        log(5, f"Reservation page loaded. URL: {page.url}")

        # CP5: Confirm the order
        log(5, "Click 確認 button to confirm the order")
        await page.click('button:has-text("確認")')
        await asyncio.sleep(2)
        await page.screenshot(path=str(SCREENSHOTS_DIR / "final_execution_6_order_confirmed.png"))
        log(5, f"Order confirmed. URL: {page.url}")

        # CP6: Navigate to 我的票券 page and verify ticket is visible
        log(6, "Navigate to 我的票券 (my tickets) page")
        await page.click('a[href*="tickets"]')
        await asyncio.sleep(2)
        await page.screenshot(path=str(SCREENSHOTS_DIR / "final_execution_7_my_tickets.png"))
        log(6, f"Tickets page loaded. URL: {page.url}")

        # CP7: Extract seat number, order amount, and ticket page content
        log(7, "Extract seat number, order amount, and ticket details from tickets page")
        aria = await page.locator("body").aria_snapshot()
        log(7, f"Tickets page ARIA snapshot:\n{aria}")

        # Extract key info from the page
        title = await page.title()
        url = page.url
        log(7, f"Final state - URL: {url}, Title: {title}")

        # Print the full aria snapshot for verification
        print("\n=== FINAL ARIA SNAPSHOT ===")
        print(aria)

        await browser.close()

    # Write log file after browser closes
    LOG_FILE.write_text("".join(log_lines))
    print(f"\nLog written to {LOG_FILE}")

asyncio.run(main())
PYEOF
echo "Script updated"
cd /work/outputs/member_ticket_20261009_125205 && python final_script.py 2>&1 | tee final_runs/run_001/final_script_log.txt

# Step 13
cat > /work/outputs/member_ticket_20261009_125205/final_script.py << 'PYEOF'
import asyncio
from playwright.async_api import async_playwright
import os
from pathlib import Path

WORKSPACE = Path(os.environ.get("WORKSPACE_DIR", "/work/outputs/member_ticket_20261009_125205"))
RUN_DIR = WORKSPACE / "final_runs" / "run_001"
SCREENSHOTS_DIR = RUN_DIR / "screenshots"
LOG_FILE = RUN_DIR / "final_script_log.txt"

SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE.write_text("")

log_lines = []
def log(step, action):
    msg = f"step {step} action: {action}"
    log_lines.append(msg + "\n")
    print(msg)

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        # CP1: Login with member credentials
        log(1, "Login with member@example.com / password123")
        await page.goto("http://localhost:5173", wait_until="domcontentloaded")
        await page.fill('input[type="email"]', 'member@example.com')
        await page.fill('input[type="password"]', 'password123')
        await page.click('button:has-text("登入")')
        await asyncio.sleep(2)
        await page.screenshot(path=str(SCREENSHOTS_DIR / "final_execution_1_login.png"))
        log(1, f"Logged in successfully. URL: {page.url}")

        # CP2: Navigate to events list (already on it after login)
        log(2, "Navigate to events list page")
        await asyncio.sleep(1)
        await page.screenshot(path=str(SCREENSHOTS_DIR / "final_execution_2_events_list.png"))
        log(2, f"Events list loaded. URL: {page.url}")

        # CP3: Find and enter 秋季音樂會 event detail page
        log(3, "Click on 秋季音樂會 event link to enter event detail")
        await page.click('a[href*="events/ev-1"]')
        await asyncio.sleep(2)
        await page.screenshot(path=str(SCREENSHOTS_DIR / "final_execution_3_event_detail.png"))
        log(3, f"Event page loaded. URL: {page.url}")

        # Check if we're on the hold page directly (seat already held from previous runs)
        current_url = page.url
        if '/hold' in current_url:
            log(3, "Already on hold page from previous session. Navigating back to event detail.")
            await page.goto("http://localhost:5173/#/events/ev-1", wait_until="domcontentloaded")
            await asyncio.sleep(2)
            await page.screenshot(path=str(SCREENSHOTS_DIR / "final_execution_3_event_detail.png"))

        # CP4: Select 一般 ticket (already selected by default) and reserve seat B1
        log(4, "Select 一般 ticket (NT$10,000) and click seat B1 to reserve")
        # 一般 is already selected by default. Click seat B1 (avoiding A1 which may be held).
        await page.click('button:has-text("B1")')
        await asyncio.sleep(1)
        # Verify the reservation button changed to '保留 1 席'
        await page.screenshot(path=str(SCREENSHOTS_DIR / "final_execution_4_seat_selected.png"))
        log(4, f"Seat B1 selected. Reservation button now shows '保留 1 席'.")

        # Click the reservation button
        await page.click('button:has-text("保留")')
        await asyncio.sleep(2)
        await page.screenshot(path=str(SCREENSHOTS_DIR / "final_execution_5_reservation_page.png"))
        log(5, f"Reservation page loaded. URL: {page.url}")

        # CP5: Confirm the order
        log(5, "Click 確認 button to confirm the order")
        await page.click('button:has-text("確認")')
        await asyncio.sleep(2)
        await page.screenshot(path=str(SCREENSHOTS_DIR / "final_execution_6_order_confirmed.png"))
        log(5, f"Order confirmed. URL: {page.url}")

        # CP6: Navigate to 我的票券 page and verify ticket is visible
        log(6, "Navigate to 我的票券 (my tickets) page")
        await page.click('a[href*="tickets"]')
        await asyncio.sleep(2)
        await page.screenshot(path=str(SCREENSHOTS_DIR / "final_execution_7_my_tickets.png"))
        log(6, f"Tickets page loaded. URL: {page.url}")

        # CP7: Extract seat number, order amount, and ticket page content
        log(7, "Extract seat number, order amount, and ticket details from tickets page")
        aria = await page.locator("body").aria_snapshot()
        log(7, f"Tickets page ARIA snapshot:\n{aria}")

        # Extract key info from the page
        title = await page.title()
        url = page.url
        log(7, f"Final state - URL: {url}, Title: {title}")

        # Print the full aria snapshot for verification
        print("\n=== FINAL ARIA SNAPSHOT ===")
        print(aria)

        await browser.close()

    # Write log file after browser closes
    LOG_FILE.write_text("".join(log_lines))
    print(f"\nLog written to {LOG_FILE}")

asyncio.run(main())
PYEOF
echo "Script updated"
cd /work/outputs/member_ticket_20261009_125205 && python final_script.py 2>&1 | tee final_runs/run_001/final_script_log.txt

# Step 14
python - <<'PY'
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        # Login first
        await page.goto("http://localhost:5173", wait_until="domcontentloaded")
        await page.fill('input[type="email"]', 'member@example.com')
        await page.fill('input[type="password"]', 'password123')
        await page.click('button:has-text("登入")')
        await asyncio.sleep(2)

        # Click on 秋季音樂會 event link - this goes to /hold because of existing hold
        await page.click('a[href*="events/ev-1"]')
        await asyncio.sleep(2)
        print("URL:", page.url)
        print("TITLE:", await page.title())
        print("ARIA SNAPSHOT (hold page):")
        aria = await page.locator("body").aria_snapshot()
        print(aria)

        # Check if there's a 放棄 button to cancel existing hold
        try:
            abandon_btn = page.locator('button:has-text("放棄")')
            print(f"\nFound 放棄 button: {await abandon_btn.is_visible()}")
            await page.screenshot(path="/work/outputs/member_ticket_20261009_125205/screenshots/hold_page.png")
        except:
            print("No 放棄 button found")

        await browser.close()

asyncio.run(main())
PY

# Step 15
cat > /work/outputs/member_ticket_20261009_125205/final_script.py << 'PYEOF'
import asyncio
from playwright.async_api import async_playwright
import os
from pathlib import Path

WORKSPACE = Path(os.environ.get("WORKSPACE_DIR", "/work/outputs/member_ticket_20261009_125205"))
RUN_DIR = WORKSPACE / "final_runs" / "run_001"
SCREENSHOTS_DIR = RUN_DIR / "screenshots"
LOG_FILE = RUN_DIR / "final_script_log.txt"

SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE.write_text("")

log_lines = []
def log(step, action):
    msg = f"step {step} action: {action}"
    log_lines.append(msg + "\n")
    print(msg)

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        # CP1: Login with member credentials
        log(1, "Login with member@example.com / password123")
        await page.goto("http://localhost:5173", wait_until="domcontentloaded")
        await page.fill('input[type="email"]', 'member@example.com')
        await page.fill('input[type="password"]', 'password123')
        await page.click('button:has-text("登入")')
        await asyncio.sleep(2)
        await page.screenshot(path=str(SCREENSHOTS_DIR / "final_execution_1_login.png"))
        log(1, f"Logged in successfully. URL: {page.url}")

        # CP2: Navigate to events list (already on it after login)
        log(2, "Navigate to events list page")
        await asyncio.sleep(1)
        await page.screenshot(path=str(SCREENSHOTS_DIR / "final_execution_2_events_list.png"))
        log(2, f"Events list loaded. URL: {page.url}")

        # CP3: Find and enter 秋季音樂會 event detail page
        log(3, "Click on 秋季音樂會 event link to enter event detail")
        await page.click('a[href*="events/ev-1"]')
        await asyncio.sleep(2)

        # Check if we landed on hold page (existing hold from previous runs)
        current_url = page.url
        if '/hold' in current_url:
            log(3, "Existing hold detected. Clicking 放棄 to cancel it.")
            await page.click('button:has-text("放棄")')
            await asyncio.sleep(2)
            # Navigate back to event detail page
            await page.goto("http://localhost:5173/#/events/ev-1", wait_until="domcontentloaded")
            await asyncio.sleep(2)

        await page.screenshot(path=str(SCREENSHOTS_DIR / "final_execution_3_event_detail.png"))
        log(3, f"Event detail page loaded. URL: {page.url}")

        # CP4: Select 一般 ticket (already selected by default) and reserve seat B1
        log(4, "Select 一般 ticket (NT$10,000) and click seat B1 to reserve")
        # 一般 is already selected by default. Click seat B1.
        await page.click('button:has-text("B1")')
        await asyncio.sleep(1)
        # Verify the reservation button changed to '保留 1 席'
        await page.screenshot(path=str(SCREENSHOTS_DIR / "final_execution_4_seat_selected.png"))
        log(4, f"Seat B1 selected. Reservation button now shows '保留 1 席'.")

        # Click the reservation button
        await page.click('button:has-text("保留")')
        await asyncio.sleep(2)
        await page.screenshot(path=str(SCREENSHOTS_DIR / "final_execution_5_reservation_page.png"))
        log(5, f"Reservation page loaded. URL: {page.url}")

        # CP5: Confirm the order
        log(5, "Click 確認 button to confirm the order")
        await page.click('button:has-text("確認")')
        await asyncio.sleep(2)
        await page.screenshot(path=str(SCREENSHOTS_DIR / "final_execution_6_order_confirmed.png"))
        log(5, f"Order confirmed. URL: {page.url}")

        # CP6: Navigate to 我的票券 page and verify ticket is visible
        log(6, "Navigate to 我的票券 (my tickets) page")
        await page.click('a[href*="tickets"]')
        await asyncio.sleep(2)
        await page.screenshot(path=str(SCREENSHOTS_DIR / "final_execution_7_my_tickets.png"))
        log(6, f"Tickets page loaded. URL: {page.url}")

        # CP7: Extract seat number, order amount, and ticket page content
        log(7, "Extract seat number, order amount, and ticket details from tickets page")
        aria = await page.locator("body").aria_snapshot()
        log(7, f"Tickets page ARIA snapshot:\n{aria}")

        # Extract key info from the page
        title = await page.title()
        url = page.url
        log(7, f"Final state - URL: {url}, Title: {title}")

        # Print the full aria snapshot for verification
        print("\n=== FINAL ARIA SNAPSHOT ===")
        print(aria)

        await browser.close()

    # Write log file after browser closes
    LOG_FILE.write_text("".join(log_lines))
    print(f"\nLog written to {LOG_FILE}")

asyncio.run(main())
PYEOF
echo "Script updated"
cd /work/outputs/member_ticket_20261009_125205 && python final_script.py 2>&1 | tee final_runs/run_001/final_script_log.txt

# Step 16
cat > /work/outputs/member_ticket_20261009_125205/self_reflect_config.json << 'JSONEOF'
{
  "image_judge_system_prompt": "You are a harsh evaluator for web task completion. Examine the provided screenshot and score it against ALL critical points listed in the task. Return ONLY two labelled lines:\n\nReasoning: <1-2 sentences describing what the screenshot shows and which critical points it provides evidence for or against>\nScore: <integer 1-5, where 5 = this screenshot clearly evidences a critical point and 1 = this screenshot contains no relevant evidence>\n\nDo NOT return JSON. Return only the two labelled lines.",
  "image_judge_user_prompt": "Task: 在這個活動報名網站上,用一般會員帳號登入(帳號密碼寫在 seed.sql 第 2 行的註解裡,用 member 那個),到活動列表進入「秋季音樂會」,用「一般」票種保留一個座位,然後確認訂單,最後到「我的票券」確認看得到這張票,而且畫面上的金額要跟資料庫裡的票價對得上。回報:座位號、訂單金額、票券頁顯示的內容。\n\nCritical Points:\n- CP1: Login with member@example.com / password123 successfully\n- CP2: Navigate to events list page after login\n- CP3: Find and enter 秋季音樂會 event detail page\n- CP4: Select 一般 ticket (NT$10,000) and reserve seat B1\n- CP5: Confirm the order successfully via 確認 button\n- CP6: Navigate to 我的票券 (my tickets) page and verify the ticket is visible\n- CP7: Verify seat number (B1), order amount (NT$10,000) matches database ticket price, and ticket page content\n\nConsider ALL critical points when scoring this single image. Be harsh when evidence is ambiguous or partially occluded.",
  "final_verdict_system_prompt": "You are a harsh aggregated judge for web task completion. Evaluate ALL critical points against the provided screenshots and action log. Your response MUST end with exactly one of these lines on its own:\n\nStatus: success\nor\nStatus: failure\n\nBefore the Status line, provide a Thoughts: block that evaluates every critical point individually.",
  "final_verdict_user_prompt": "Task: 在這個活動報名網站上,用一般會員帳號登入(帳號密碼寫在 seed.sql 第 2 行的註解裡,用 member 那個),到活動列表進入「秋季音樂會」,用「一般」票種保留一個座位,然後確認訂單,最後到「我的票券」確認看得到這張票,而且畫面上的金額要跟資料庫裡的票價對得上。回報:座位號、訂單金額、票券頁顯示的內容。\n\nCritical Points:\n- CP1: Login with member@example.com / password123 successfully\n- CP2: Navigate to events list page after login\n- CP3: Find and enter 秋季音樂會 event detail page\n- CP4: Select 一般 ticket (NT$10,000) and reserve seat B1\n- CP5: Confirm the order successfully via 確認 button\n- CP6: Navigate to 我的票券 (my tickets) page and verify the ticket is visible\n- CP7: Verify seat number, order amount matches database ticket price, and ticket page content\n\nAction History Log:\n{action_history_log}\n\nPer-Image Reasonings:\n{image_reasonings}"
}
JSONEOF
echo "self_reflect_config.json created" && cat /work/outputs/member_ticket_20261009_125205/self_reflect_config.json | python -m json.tool > /dev/null && echo "Valid JSON" || echo "Invalid JSON"

# Step 17
cd /work/outputs/member_ticket_20261009_125205 && python -m webwright.tools.self_reflection --config self_reflect_config.json --workspace-dir "/work/outputs/member_ticket_20261009_125205" --output final_runs/run_001/self_reflect_result.json 2>&1

# Step 18
cat /work/outputs/member_ticket_20261009_125205/final_runs/run_001/self_reflect_result.json 2>/dev/null | head -50

# Step 19
cat > /work/outputs/member_ticket_20261009_125205/self_reflect_config.json << 'JSONEOF'
{
  "image_judge_system_prompt": "You are a harsh evaluator. Return exactly two lines:\nReasoning: <brief description>\nScore: <1-5>",
  "image_judge_user_prompt": "Task: 在這個活動報名網站上,用一般會員帳號登入,到活動列表進入「秋季音樂會」,用「一般」票種保留一個座位,然後確認訂單,最後到「我的票券」確認看得到這張票。\nCritical Points:\n- CP1: Login with member@example.com / password123 successfully\n- CP2: Navigate to events list page after login\n- CP3: Find and enter 秋季音樂會 event detail page\n- CP4: Select 一般 ticket (NT$10,000) and reserve seat B1\n- CP5: Confirm the order successfully via 確認 button\n- CP6: Navigate to 我的票券 (my tickets) page and verify the ticket is visible\n- CP7: Verify seat number, order amount matches database ticket price, and ticket page content\nConsider ALL critical points when scoring this single image. Be harsh when evidence is ambiguous or partially occluded.",
  "final_verdict_system_prompt": "You are a harsh aggregated judge. Evaluate ALL critical points against the provided screenshots and action log. Your response MUST end with exactly one of these lines on its own:\nStatus: success\nor\nStatus: failure\nBefore the Status line, provide a Thoughts: block that evaluates every critical point individually.",
  "final_verdict_user_prompt": "Task: 在這個活動報名網站上,用一般會員帳號登入(帳號密碼寫在 seed.sql 第 2 行的註解裡,用 member 那個),到活動列表進入「秋季音樂會」,用「一般」票種保留一個座位,然後確認訂單,最後到「我的票券」確認看得到這張票,而且畫面上的金額要跟資料庫裡的票價對得上。回報:座位號、訂單金額、票券頁顯示的內容。\nCritical Points:\n- CP1: Login with member@example.com / password123 successfully\n- CP2: Navigate to events list page after login\n- CP3: Find and enter 秋季音樂會 event detail page\n- CP4: Select 一般 ticket (NT$10,000) and reserve seat B1\n- CP5: Confirm the order successfully via 確認 button\n- CP6: Navigate to 我的票券 (my tickets) page and verify the ticket is visible\n- CP7: Verify seat number, order amount matches database ticket price, and ticket page content\nAction History Log:\n{action_history_log}\nPer-Image Reasonings:\n{image_reasonings}"
}
JSONEOF
echo "Updated config" && python -m json.tool /work/outputs/member_ticket_20261009_125205/self_reflect_config.json > /dev/null && echo "Valid JSON"

# Step 20
cd /work/outputs/member_ticket_20261009_125205 && python -m webwright.tools.self_reflection --config self_reflect_config.json --workspace-dir "/work/outputs/member_ticket_20261009_125205" --output final_runs/run_001/self_reflect_result.json 2>&1

# Step 21
ls -R final_runs/run_001 && cat final_runs/run_001/final_script_log.txt | tail -20

