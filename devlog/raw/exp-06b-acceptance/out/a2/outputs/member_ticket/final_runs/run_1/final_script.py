import asyncio, json, sqlite3
from pathlib import Path
from playwright.async_api import async_playwright

RUN_DIR = Path(__file__).parent
SCREENSHOTS = RUN_DIR / "screenshots"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)
LOG = RUN_DIR / "final_script_log.txt"
LOG.write_text("")
BASE = "http://localhost:5173"
DB = "<lab>/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/9741b5f591844eab0bbb845f07239462de71d1dc9e83cf98c07e508fa8305181.sqlite"

def log(step, msg):
    line = f"step {step} action: {msg}\n"
    with LOG.open("a") as f: f.write(line)
    print(line, end="")

def note(msg):
    with LOG.open("a") as f: f.write(msg + "\n")
    print(msg)

def db(q, *a):
    con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    try: return con.execute(q, a).fetchall()
    finally: con.close()

async def shot(page, n, name):
    await page.screenshot(path=str(SCREENSHOTS / f"final_execution_{n}_{name}.png"))

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(channel="chrome", headless=True)
        page = await (await browser.new_context(viewport={"width": 1280, "height": 1800})).new_page()
        api = []
        async def on_resp(r):
            if "/api" in r.url or "/holds" in r.url or "/orders" in r.url:
                try: api.append((r.request.method, r.url, r.status, await r.text()))
                except Exception: pass
        page.on("response", on_resp)

        # CP1 login
        await page.goto(f"{BASE}/#/login", wait_until="networkidle")
        await page.get_by_role("textbox", name="email").fill("member@example.com")
        await page.get_by_role("textbox", name="密碼(至少 8 字元)").fill("password123")
        await page.get_by_role("button", name="登入", exact=True).click()
        await page.wait_for_load_state("networkidle"); await asyncio.sleep(1)
        await shot(page, 1, "after_login")
        log(1, f"login as member@example.com; url={page.url}; nav={await page.locator('body').inner_text()[:0] if False else ''}")
        note("  header: " + " | ".join((await page.locator("body").inner_text()).splitlines()[:6]))

        # CP2 events list -> 秋季音樂會
        await page.get_by_role("link", name="活動報名").click()
        await page.wait_for_load_state("networkidle"); await asyncio.sleep(1)
        await shot(page, 2, "events_list")
        log(2, f"open events list; url={page.url}")
        await page.get_by_text("秋季音樂會").first.click()
        await page.wait_for_selector("#tt"); await asyncio.sleep(1)
        log(3, f"enter 秋季音樂會 detail; url={page.url}")

        # CP3 select 一般, pick first free seat, hold
        opt_val = await page.locator("#tt option", has_text="一般").first.get_attribute("value")
        await page.select_option("#tt", opt_val)
        opt_text = (await page.locator("#tt option:checked").inner_text()).strip()
        seat_btn = page.locator("button[data-seat].btn-outline").first
        seat = await seat_btn.get_attribute("data-seat")
        await seat_btn.click()
        await shot(page, 3, "ticket_type_and_seat_selected")
        log(4, f"select ticket type value={opt_val} text='{opt_text}', pick seat {seat}; hold button='{await page.locator('#hold').inner_text()}'")
        await page.locator("#hold").click()
        await page.wait_for_url("**/hold"); await page.wait_for_selector("#price div"); await asyncio.sleep(1.5)
        title = (await page.locator(".card-title").inner_text()).strip()
        price_txt = (await page.locator("#price").inner_text()).strip()
        await shot(page, 4, "seat_held_quote")
        log(5, f"hold placed; title='{title}'; quote='{' / '.join(price_txt.splitlines())}'")
        hold_rows = db("select id, seat_nos_or_null from (select id, null as seat_nos_or_null from seat_holds) ") if False else db("select * from seat_holds")
        note(f"  DB seat_holds: {hold_rows}")

        # CP4 confirm
        await page.locator("#ok").click()
        await page.wait_for_url("**/#/tickets"); await page.wait_for_load_state("networkidle"); await asyncio.sleep(1.5)
        log(6, f"confirm order; url={page.url}")

        # CP5 tickets page
        card = page.locator(".card").filter(has_text="秋季音樂會").first
        card_txt = (await card.inner_text()).strip()
        await shot(page, 5, "my_tickets")
        log(7, "my tickets card: " + " / ".join(card_txt.splitlines()))

        # CP6 DB cross-check
        tt = db("select id, name, price_cents from ticket_types where event_id='ev-1' and name='一般'")
        orders = db("select o.id, o.status, o.subtotal_cents, o.total_cents from orders o where o.member_id='member-1'") if True else []
        items = db("select * from order_items")
        note(f"  DB ticket_types 一般: {tt}")
        note(f"  DB orders(member-1): {orders}")
        note(f"  DB order_items: {items}")
        for m, u, s, t in api:
            if m != "GET" or "/orders" in u:
                note(f"  API {m} {u} {s} {t[:400]}")

        price_cents = tt[0][2]
        expect = f"NT${price_cents // 100:,}"
        shown_total = [l for l in card_txt.splitlines() if l.startswith("總計")]
        match = expect in card_txt
        note(f"\nDB 票價 price_cents={price_cents} → 應顯示 {expect}; 票券頁顯示: {shown_total}; 一致={match}")
        note(f"FINAL_RESPONSE: seat={seat}; hold quote='{' / '.join(price_txt.splitlines())}'; tickets card='{' / '.join(card_txt.splitlines())}'; DB price={expect}; amount_matches_db={match}")
        await browser.close()

asyncio.run(main())
