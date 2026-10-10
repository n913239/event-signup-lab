import asyncio, sqlite3
from pathlib import Path
from playwright.async_api import async_playwright

RUN = Path(__file__).resolve().parent
SHOTS = RUN / "screenshots"; SHOTS.mkdir(parents=True, exist_ok=True)
LOG = RUN / "final_script_log.txt"; LOG.write_text("")
BASE = "http://localhost:5173"
DB = "<lab>/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/9741b5f591844eab0bbb845f07239462de71d1dc9e83cf98c07e508fa8305181.sqlite"

def log(s):
    print(s)
    with LOG.open("a") as f: f.write(s + "\n")

def db_query(sql):
    con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    try: return con.execute(sql).fetchall()
    finally: con.close()

def ntd(cents):  # 正確的 分→元 換算,作為比對基準
    return f"NT${cents // 100:,}" + (f".{cents % 100:02d}" if cents % 100 else "")

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(channel="chrome", headless=True)
        pg = await (await b.new_context(viewport={"width": 1280, "height": 1800})).new_page()

        await pg.goto(BASE, wait_until="networkidle")
        await pg.get_by_role("textbox", name="email").fill("member@example.com")
        await pg.get_by_role("textbox", name="密碼(至少 8 字元)").fill("password123")
        await pg.get_by_role("button", name="登入", exact=True).click()
        await pg.get_by_role("button", name="登出").wait_for()
        await pg.screenshot(path=str(SHOTS / "final_execution_1_login.png"))
        log(f"step 1 action: login as member@example.com -> url {pg.url}, 登出 button visible")

        await pg.get_by_role("link", name="秋季音樂會").click()
        await pg.get_by_role("heading", name="秋季音樂會", level=2).wait_for()
        await pg.screenshot(path=str(SHOTS / "final_execution_2_event_detail.png"))
        log(f"step 2 action: click 秋季音樂會 in event list -> {pg.url}")

        sel = pg.locator("main select")
        opt = sel.locator("option", has_text="一般")
        await sel.select_option(value=await opt.get_attribute("value"))
        opt_text = (await opt.inner_text()).strip()
        log(f"step 3 action: select ticket type 一般 -> option text '{opt_text}'")

        seat = pg.locator("main button[data-seat]:not([disabled])").first
        seat_no = (await seat.inner_text()).strip()
        await seat.click()
        await pg.get_by_role("button", name="保留 1 席").wait_for()
        await pg.screenshot(path=str(SHOTS / "final_execution_3_seat_selected.png"))
        log(f"step 4 action: click first free seat {seat_no} -> button shows 保留 1 席")

        await pg.get_by_role("button", name="保留 1 席").click()
        await pg.wait_for_url("**/hold")
        await pg.locator("#price").get_by_text("應付").wait_for()
        hold_title = (await pg.locator("main h2").inner_text()).strip()
        price_text = " | ".join(t.strip() for t in await pg.locator("#price > div").all_inner_texts())
        await pg.screenshot(path=str(SHOTS / "final_execution_4_hold.png"))
        log(f"step 5 action: click 保留 1 席 -> {pg.url}; title '{hold_title}'; price '{price_text}'")

        await pg.locator("#ok").click()
        await pg.wait_for_url("**/tickets", timeout=10000)
        await pg.get_by_role("heading", name="我的票券").wait_for()
        await pg.wait_for_timeout(800)
        await pg.screenshot(path=str(SHOTS / "final_execution_5_confirmed_tickets.png"))
        log(f"step 6 action: click 確認 -> redirected to {pg.url}")

        await pg.get_by_role("link", name="我的票券").click()
        await pg.wait_for_timeout(1000)
        tickets_text = (await pg.locator("main").inner_text()).strip()
        await pg.screenshot(path=str(SHOTS / "final_execution_6_my_tickets.png"))
        log("step 7 action: open 我的票券 nav link; page text:\n" + tickets_text)
        await b.close()

    tt = db_query("select name, price_cents from ticket_types where id='tt-general'")[0]
    orders = db_query("select o.id, o.status, o.subtotal_cents, o.total_cents, oi.seat_no, oi.unit_price_cents "
                      "from orders o join order_items oi on oi.order_id=o.id order by o.confirmed_at desc limit 1")
    log(f"step 8 action: read-only DB check -> ticket_types 一般 price_cents={tt[1]} (= {ntd(tt[1])}); latest order row={orders}")
    o = orders[0]
    ui_ok = ntd(o[3]) in tickets_text and ntd(tt[1]) in tickets_text
    log(f"step 9 action: compare UI vs DB -> expected {ntd(tt[1])} on page: {'MATCH' if ui_ok else 'MISMATCH'}")
    log(f"FINAL: seat={o[4]}; order total (DB)={o[3]} cents = {ntd(o[3])}; UI shown amounts in '{price_text}'; tickets page='{tickets_text.replace(chr(10), ' / ')}'; UI==DB: {ui_ok}")

asyncio.run(main())
