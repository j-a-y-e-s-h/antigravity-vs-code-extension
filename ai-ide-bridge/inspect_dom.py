import asyncio
from playwright.async_api import async_playwright


async def inspect():
    async with async_playwright() as p:
        # Connect to the existing profile or launch a new one
        browser = await p.chromium.launch_persistent_context(
            user_data_dir="c:/Users/jke36/Desktop/My Work/0.1 NEW/files/ai-ide-bridge/browser_profile",
            headless=True
        )
        page = browser.pages[0] if browser.pages else await browser.new_page()
        print("Navigating to Claude...")
        await page.goto("https://claude.ai/new")
        await asyncio.sleep(3)
        print("Dumping body HTML...")
        html = await page.evaluate("document.body.innerHTML")

        with open("claude_dom.html", "w", encoding="utf-8") as f:
            f.write(html)

        print("Done. Saved to claude_dom.html")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(inspect())
