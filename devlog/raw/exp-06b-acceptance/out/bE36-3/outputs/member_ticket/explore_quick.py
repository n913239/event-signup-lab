import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

SCREENSHOTS = Path("screenshots")
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        # Try login directly from start URL (no navigation to events first)
        print("Starting...")
        
        # Use fetch directly instead of page interaction to debug login API
        import httpx
        async with httpx.AsyncClient() as client:
            r = await client.post("http://localhost:5173/api/auth/login",
                                  content='{"email":"member@example.com","password":"password123"}',
                                  headers={"Content-Type": "application/json"})
            print("Direct API response status:", r.status_code)
            print("Direct API response body:", r.text[:500])

        await browser.close()
        
asyncio.run(main())
