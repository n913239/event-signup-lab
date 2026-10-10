# Step 1
head -5 <lab>/seed.sql

# Step 2
ls -la

# Step 3
cat <lab>/seed.sql | head -10

# Step 4
cat task.json

# Step 5
cat task.json

# Step 6
cat > /work/outputs/member_ticket_20261009_184833/plan.md << 'EOF'
# Critical Points
- [ ] CP1: Login with member account (member@example.com/password123)
- [ ] CP2: Navigate to event list and find '秋季音樂會' (Autumn Concert) event
- [ ] CP3: Select '一般' (General) ticket type for 1 seat
- [ ] CP4: Confirm the order
- [ ] CP5: Go to My Tickets page and verify the ticket is visible
- [ ] CP6: Verify displayed price matches database price
EOF

# Step 7
python3 -c "import json; print(json.dumps({'test': 'ok'}))"

# Step 8
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

