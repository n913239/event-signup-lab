python3 -m playwright.sync_api sync_playwright << 'PY'
from playwright.sync_api import sync_playwright
import os

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 1280, 'height': 1800})
    page = context.new_page()
    page.goto('http://localhost:5173', wait_until='domcontentloaded')
    print('URL:', page.url)
    print('Title:', page.title())
    # Save screenshot
    os.makedirs('/work/outputs/member_ticket_20261009_184833/screenshots', exist_ok=True)
    page.screenshot(path='/work/outputs/member_ticket_20261009_184833/screenshots/01_start_page.png')
    # Get aria snapshot
    print('ARIA:', page.locator('body').aria_snapshot())
    browser.close()
PY
