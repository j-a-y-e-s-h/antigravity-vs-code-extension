import asyncio
from playwright.async_api import async_playwright, Page, Browser, BrowserContext
import json
import os
from pathlib import Path
from typing import Optional, List, Dict
import time


class ClaudeWebClient:
    """
    Automates interactions with claude.ai web interface.
    Handles authentication, message sending, and response extraction.
    """

    def __init__(self, session_dir: str = "./sessions"):
        self.session_dir = Path(session_dir)
        self.session_dir.mkdir(exist_ok=True, parents=True)
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self.is_authenticated = False
        self.current_chat_id: Optional[str] = None
        self.playwright = None

        # Load selectors
        selectors_path = Path(__file__).parent / "selectors.json"
        if selectors_path.exists():
            with open(selectors_path, 'r', encoding='utf-8') as f:
                self.selectors = json.load(f)
        else:
            self.selectors = {}

    async def _wait_for_any_selector(self, selector_names: List[str], timeout: int = 5000) -> str:
        """Helper to try multiple selectors until one works, returning the successful selector."""
        for selector in selector_names:
            try:
                el = await self.page.wait_for_selector(selector, timeout=timeout)
                if el:
                    return selector
            except:
                pass
        raise Exception(f"None of the selectors found: {selector_names}")

    async def initialize(self, headless: bool = True):
        """Initialize browser with persistent session."""
        self.playwright = await async_playwright().start()

        # Use persistent context to maintain login session
        self.context = await self.playwright.chromium.launch_persistent_context(
            user_data_dir=str(self.session_dir / "chrome_profile"),
            headless=headless,
            viewport={'width': 1920, 'height': 1080},
            args=[
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
            ],
            # Mimic real user
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        )

        self.page = await self.context.new_page()

        # Add stealth scripts to avoid detection
        await self.page.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
        """)

    async def authenticate(self) -> bool:
        """
        Authenticate with claude.ai.
        Returns True if authenticated, False if manual intervention needed.
        """
        print("→ Checking authentication status...")
        await self.page.goto('https://claude.ai/chats', wait_until='networkidle')
        await asyncio.sleep(2)

        chat_inputs = self.selectors.get(
            "chat_input", ['div[contenteditable="true"]'])

        # Check if already logged in
        try:
            await self._wait_for_any_selector(chat_inputs, timeout=5000)
            self.is_authenticated = True
            print("✓ Already authenticated via session")
            return True
        except:
            pass

        # Not authenticated - need manual login
        print("! Authentication required")
        print("! Opening login page...")
        print("! Please log in manually in the browser window")
        print("! Waiting for authentication...")

        await self.page.goto('https://claude.ai/login')

        # Wait for user to log in (check for chat input)
        try:
            # Check repeatedly for 2 minutes
            for _ in range(24):  # 24 * 5s = 120s
                try:
                    await self._wait_for_any_selector(chat_inputs, timeout=5000)
                    self.is_authenticated = True
                    print("✓ Authentication successful!")
                    return True
                except:
                    pass
            print("✗ Authentication timeout")
            return False
        except:
            return False

    async def ensure_chat(self) -> str:
        """Ensure we have an active chat session."""
        if self.current_chat_id:
            return self.current_chat_id

        # Create new chat
        print("→ Creating new chat...")
        await self.page.goto('https://claude.ai/new')
        await asyncio.sleep(2)

        # Extract chat ID from URL
        current_url = self.page.url
        if '/chat/' in current_url:
            self.current_chat_id = current_url.split('/chat/')[-1]
            print(f"✓ Chat created: {self.current_chat_id}")
        else:
            # When on /new, the ID is only generated after sending the first message
            self.current_chat_id = "new"
            print("✓ Navigated to new chat page")

        return self.current_chat_id

    async def send_message(self, message: str, chat_id: Optional[str] = None, stream_callback=None) -> str:
        """
        Send a message to Claude and wait for complete response.
        Returns the response text.
        """
        if not self.is_authenticated:
            raise RuntimeError("Not authenticated. Call authenticate() first.")

        # Ensure we have a chat
        active_chat_id = chat_id or await self.ensure_chat()

        # Navigate to chat if not already there
        is_on_chat = '/chat/' in self.page.url and active_chat_id in self.page.url
        is_on_new = active_chat_id == "new" and self.page.url.endswith('/new')

        if not is_on_chat and not is_on_new:
            target_url = 'https://claude.ai/new' if active_chat_id == "new" else f'https://claude.ai/chat/{active_chat_id}'
            await self.page.goto(target_url)
            await asyncio.sleep(1)

        # Find the input field
        chat_inputs = self.selectors.get(
            "chat_input", ['div[contenteditable="true"]'])
        successful_input_selector = await self._wait_for_any_selector(chat_inputs, timeout=10000)

        # Count existing copy buttons to know when the new message finishes
        copy_buttons = self.selectors.get(
            "copy_buttons", ['button[aria-label*="Copy"]'])
        copy_selector_str = ", ".join(copy_buttons)
        existing_copy_buttons = len(await self.page.query_selector_all(copy_selector_str))

        # Type the message
        input_field = await self.page.query_selector(successful_input_selector)
        await input_field.click()
        await input_field.fill(message)
        await asyncio.sleep(0.5)

        # Send message (Ctrl+Enter or Enter key)
        await self.page.keyboard.press('Enter')

        print("→ Message sent, waiting for response...")

        # Wait for response to complete using copy button count logic
        response = await self._wait_for_response_completion(existing_copy_buttons, stream_callback=stream_callback)

        # Update current chat ID if we just started a 'new' chat
        if self.current_chat_id == "new" and '/chat/' in self.page.url:
            self.current_chat_id = self.page.url.split('/chat/')[-1]
            print(f"✓ Chat ID updated to: {self.current_chat_id}")

        return response

    async def stop_generation(self) -> bool:
        """Click the stop generating button if it exists."""
        stop_selectors = self.selectors.get(
            "stop_buttons", ['button[aria-label*="Stop"], button[title*="Stop"]'])
        for sel in stop_selectors:
            try:
                el = await self.page.query_selector(sel)
                if el and await el.is_visible():  # Ensure the button is visible before clicking
                    await el.click()
                    print("✓ Clicked Stop button")
                    return True
            except Exception as e:
                # print(f"Error checking/clicking stop button with selector '{sel}': {e}")
                pass
        return False

    async def _wait_for_response_completion(self, previous_button_count: int, timeout: int = 180, stream_callback=None) -> str:
        """
        Wait until Claude is done generating the response by monitoring the text content of the last assistant message.
        """
        start_time = time.time()
        last_text = ""
        stable_count = 0

        print(f"  [Wait] Waiting for response to stabilize...")

        while True:
            if time.time() - start_time > timeout:
                print("⚠ Response timeout - returning partial response")
                break

            try:
                # Extract ONLY Claude's last response text using JavaScript
                text = await self.page.evaluate('''() => {
                    // Strategy 1: Look for elements with data-message-author="assistant"
                    const assistantMsgs = document.querySelectorAll('[data-message-author="assistant"]');
                    if (assistantMsgs && assistantMsgs.length > 0) {
                        const lastMsg = assistantMsgs[assistantMsgs.length - 1];
                        const prose = lastMsg.querySelector('.prose, .font-claude-message, .break-words, div.grid-cols-1');
                        if (prose && prose.innerText.trim()) return prose.innerText.trim();
                        return lastMsg.innerText.trim();
                    }
                    
                    // Strategy 2: Look for elements with data-is-streaming="false"
                    const staticBlocks = document.querySelectorAll('[data-is-streaming="false"]');
                    if (staticBlocks && staticBlocks.length > 0) {
                        for (let i = staticBlocks.length - 1; i >= 0; i--) {
                            if (!staticBlocks[i].closest('.bg-bg-300, .bg-accent')) {
                                return staticBlocks[i].innerText.trim();
                            }
                        }
                    }
                    return "";
                }''')

                # Check for "Stop" button natively
                is_generating = await self.page.evaluate('''() => {
                    const stopBtn = document.querySelector('button[aria-label*="Stop"], button[title*="Stop"]');
                    return stopBtn !== null;
                }''')

                text = text.strip() if text else ""

                if text and len(text) > len(last_text):
                    if stream_callback:
                        delta = text[len(last_text):]
                        if delta:
                            await stream_callback(delta)

                if text and text == last_text:
                    stable_count += 1
                else:
                    stable_count = 0
                    last_text = text

                # If text hasn't changed for 3 consecutive checks (approx 1.5 seconds) and not generating, done.
                if stable_count >= 3 and last_text and not is_generating:
                    print("✓ Response complete (text is stable)")
                    break

                # Broad fallback: If it's been stable for 8 seconds, it's definitely done even if a button looks like 'Stop'
                if stable_count >= 16 and last_text:
                    print("✓ Response complete (forced timeout due to UI)")
                    break

            except Exception as e:
                pass

            await asyncio.sleep(0.5)

        return last_text if last_text else "Response received but could not extract text cleanly."

    async def get_conversation_history(self, chat_id: Optional[str] = None) -> List[Dict]:
        """Retrieve full conversation history from a chat."""
        active_chat_id = chat_id or self.current_chat_id
        if not active_chat_id:
            return []

        await self.page.goto(f'https://claude.ai/chat/{active_chat_id}')
        await asyncio.sleep(2)

        messages = await self.page.query_selector_all('[data-testid^="message-"]')
        conversation = []

        for msg in messages:
            content = await msg.inner_text()

            # Determine role based on message attributes or position
            # This is a simplified version - actual implementation may need refinement
            role_indicator = await msg.get_attribute('data-testid')
            role = 'user' if 'user' in role_indicator else 'assistant'

            conversation.append({
                "role": role,
                "content": content
            })

        return conversation

    async def clear_chat(self):
        """Clear current chat and start fresh."""
        self.current_chat_id = None

    async def get_recent_chats(self, limit: int = 20) -> List[Dict[str, str]]:
        """Fetch recent chat history from Claude's sidebar using JS DOM querying."""
        # Ensure we are on a page with the sidebar loaded
        if not self.page.url.startswith('https://claude.ai/'):
            await self.page.goto('https://claude.ai/new')
            await asyncio.sleep(2)

        chat_links = self.selectors.get("chat_links", ['a[href^="/chat/"]'])
        selector_str = ", ".join(chat_links)

        chats = await self.page.evaluate(f'''() => {{
            const links = Array.from(document.querySelectorAll('{selector_str}'));
            const results = [];
            const seen = new Set();
            for (let a of links) {{
                const url = a.getAttribute('href');
                const id = url.split('/').pop();
                if (!seen.has(id) && id.length > 10) {{
                    seen.add(id);
                    let title = a.innerText.trim();
                    title = title.split('\\n')[0];
                    results.push({{id: id, title: title || 'Untitled Chat'}});
                }}
            }}
            return results.slice(0, {limit});
        }}''')
        return chats

    async def switch_chat(self, chat_id: str):
        """Switch to a specific past chat."""
        self.current_chat_id = chat_id
        await self.page.goto(f'https://claude.ai/chat/{chat_id}')
        await asyncio.sleep(1.5)

    async def close(self):
        """Clean up resources."""
        if self.page:
            await self.page.close()
        if self.context:
            await self.context.close()
        if self.playwright:
            await self.playwright.stop()


# Example usage
async def test_client():
    client = ClaudeWebClient()
    await client.initialize(headless=False)  # Set True for production

    if await client.authenticate():
        response = await client.send_message("What is the capital of France?")
        print(f"Response: {response}")

    await client.close()

if __name__ == "__main__":
    asyncio.run(test_client())
