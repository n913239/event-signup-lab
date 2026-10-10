import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
S = Path(__file__).parent / "screenshots"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(channel="chrome", headless=True)
        page = await (await b.new_context(viewport={"width":1280,"height":1800})).new_page()
        await page.goto("http://localhost:5173", wait_until="networkidle")
        print(page.url, await page.title())
        print(await page.locator("body").aria_snapshot())
        await page.screenshot(path=str(S/"explore_1_start.png"))
        await b.close()
asyncio.run(main())
