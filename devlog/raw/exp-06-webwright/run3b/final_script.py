from pathlib import Path
from playwright.sync_api import sync_playwright

RUN = Path(__file__).resolve().parent
SHOTS = RUN / "screenshots"; SHOTS.mkdir(exist_ok=True)
LOG = RUN / "final_script_log.txt"; LOG.write_text("")
BASE = "http://localhost:5173"

def log(msg):
    print(msg)
    with LOG.open("a") as f: f.write(msg + "\n")

def shot(pg, n, name):
    pg.screenshot(path=str(SHOTS / f"final_execution_{n}_{name}.png"))

with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome", headless=True)
    pg = b.new_context(viewport={"width": 1280, "height": 1800}).new_page()

    pg.goto(BASE, wait_until="networkidle")
    pg.get_by_role("textbox", name="email").fill("member@example.com")
    pg.get_by_role("textbox", name="密碼(至少 8 字元)").fill("password123")
    pg.get_by_role("button", name="登入", exact=True).click()
    pg.get_by_role("button", name="登出").wait_for()
    pg.wait_for_url("**/#/events"); pg.wait_for_load_state("networkidle")
    log("step 1 action: login as member@example.com -> logout button visible, url=" + pg.url)
    shot(pg, 1, "logged_in_events")

    pg.get_by_role("link", name="秋季音樂會").click()
    pg.get_by_role("heading", level=2, name="秋季音樂會").wait_for(); pg.wait_for_load_state("networkidle")
    log("step 2 action: open 秋季音樂會 from events list, url=" + pg.url)

    sel = pg.get_by_role("combobox")
    label = next(o for o in sel.locator("option").all_inner_texts() if o.startswith("一般"))
    sel.select_option(label=label)
    selected = sel.evaluate("s => s.options[s.selectedIndex].text")
    log(f"step 3 action: select ticket type -> {selected}")
    seat = pg.locator("button[data-seat].btn-outline").first
    seat_no = seat.get_attribute("data-seat")
    seat.click()
    hold_btn = pg.locator("#hold")
    log(f"step 4 action: pick first free seat {seat_no}; hold button reads '{hold_btn.inner_text()}'")
    shot(pg, 2, "event_general_seat_selected")

    hold_btn.click()
    pg.get_by_role("button", name="確認", exact=True).wait_for()
    pg.locator("#price >> text=應付").wait_for(); pg.wait_for_timeout(500)
    log(f"step 5 action: click hold -> {pg.locator('h2').inner_text()}; price box: {pg.locator('#price').inner_text()!r}")
    shot(pg, 3, "hold_quote")

    pg.get_by_role("button", name="確認", exact=True).click()
    pg.wait_for_url("**/#/tickets"); pg.get_by_role("heading", name="我的票券").wait_for(); pg.wait_for_load_state("networkidle")
    log("step 6 action: confirm order -> redirected to " + pg.url)
    card = pg.locator(".card").filter(has_text=f"{seat_no} 一般")
    card.first.scroll_into_view_if_needed()
    card_text = card.first.inner_text()
    log(f"step 7 action: my tickets card for {seat_no}: {card_text!r}")
    shot(pg, 4, "my_tickets")

    log(f"FINAL seat={seat_no}")
    log(f"FINAL ticket_card={card_text!r}")
    b.close()
