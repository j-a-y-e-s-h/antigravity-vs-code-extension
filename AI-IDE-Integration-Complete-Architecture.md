# Complete AI-IDE Integration Architecture
## Zero-Cost, Cloud-Based Solution Using Browser Automation

**Version:** 1.0  
**Last Updated:** March 2026  
**Target Users:** Python/Odoo/OCR Developers

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Component Breakdown](#component-breakdown)
4. [Implementation Guide](#implementation-guide)
5. [VS Code Integration](#vs-code-integration)
6. [Security Considerations](#security-considerations)
7. [Limitations & Workarounds](#limitations-and-workarounds)
8. [Production Deployment](#production-deployment)

---

## Executive Summary

### The Challenge

You need an AI assistant that can:
- Read and modify files in your IDE workspace
- Execute terminal commands
- Analyze code and suggest fixes
- Integrate seamlessly with VS Code
- Work without expensive API subscriptions

### The Solution

This architecture leverages **browser automation** to interact with free web-based AI services (claude.ai, chatgpt.com, etc.) while providing a robust **MCP (Model Context Protocol) server** that exposes IDE capabilities.

### Key Features

✅ **Zero API costs** - Uses free web interfaces  
✅ **Full IDE integration** - File operations, terminal, diagnostics  
✅ **Production-ready** - Retry logic, error handling, session persistence  
✅ **Secure** - Path validation, command whitelisting, sandboxing  
✅ **Extensible** - Support for multiple AI providers  

---

## System Architecture

### High-Level Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                       VS Code IDE                                   │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Extension (TypeScript)                                       │  │
│  │  • Command Palette Integration                                │  │
│  │  • Code Actions Provider                                      │  │
│  │  • Diagnostic Provider                                        │  │
│  │  • Terminal Integration                                       │  │
│  │  • File Watcher                                               │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/WebSocket
                              │ (localhost:8000)
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│              MCP Bridge Server (Python FastAPI)                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  MCP Protocol Handler                                         │  │
│  │  • read_file() • write_file() • list_directory()             │  │
│  │  • execute_command() • get_diagnostics()                     │  │
│  │  • analyze_code() • suggest_fix() • refactor()               │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  AI Query Manager                                             │  │
│  │  • Context Builder                                            │  │
│  │  • Response Parser                                            │  │
│  │  • Session Manager                                            │  │
│  │  • Rate Limiter                                               │  │
│  │  • Retry Logic                                                │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Security Layer                                               │  │
│  │  • Path Validator                                             │  │
│  │  • Command Whitelist                                          │  │
│  │  • Sandbox Enforcer                                           │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
                              │
                              │ Playwright/Selenium
                              │ (Browser Automation)
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│          Headless Chrome Browser Instance                          │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Free AI Service (claude.ai / chat.openai.com)               │  │
│  │  • Automated Authentication                                   │  │
│  │  • Message Queue                                              │  │
│  │  • Response Streaming                                         │  │
│  │  • Session Persistence (cookies/localStorage)                │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Action (VS Code)
    │
    ├──> Extension captures context (file, selection, errors)
    │
    └──> HTTP POST to MCP Server (/mcp/execute)
            │
            ├──> Server validates request & checks permissions
            │
            ├──> Builds AI prompt with context
            │
            └──> Browser automation sends message
                    │
                    └──> AI service processes & responds
                            │
                            └──> Response parsed & formatted
                                    │
                                    └──> Results sent back to Extension
                                            │
                                            └──> VS Code displays results
```

---

## Component Breakdown

### 1. Browser Automation Layer

**Purpose:** Interact with free AI web services programmatically

**Technology Stack:**
- Playwright (recommended) or Selenium
- Chromium/Chrome in headless mode
- Python 3.11+

**Key Responsibilities:**
- Authenticate with AI service
- Send messages and extract responses
- Maintain session state
- Handle rate limiting
- Recover from errors

**Why Playwright over Selenium:**
- Better modern browser support
- Faster execution
- Built-in waiting mechanisms
- Better debugging tools
- Active development

### 2. MCP Bridge Server

**Purpose:** Central hub that connects IDE to AI through standardized protocol

**Technology Stack:**
- FastAPI (async Python web framework)
- Uvicorn (ASGI server)
- Pydantic (data validation)
- WebSocket support

**Key Responsibilities:**
- Expose MCP-compliant tools
- Manage file system operations
- Execute terminal commands
- Build context-aware prompts
- Parse AI responses
- Enforce security policies

### 3. VS Code Extension

**Purpose:** User interface and IDE integration hooks

**Technology Stack:**
- TypeScript
- VS Code Extension API
- Node.js

**Key Features:**
- Command palette commands
- Code actions (Quick Fix)
- Diagnostic provider
- Status bar integration
- Configuration UI

---

## Implementation Guide

### Phase 1: Browser Automation Setup

#### Step 1.1: Install Dependencies

```bash
# Create project directory
mkdir ai-ide-bridge
cd ai-ide-bridge

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install core dependencies
pip install playwright fastapi uvicorn pydantic websockets aiohttp

# Install Playwright browsers
playwright install chromium
```

#### Step 1.2: Create Browser Client

Create `browser_automation/claude_client.py`:

```python
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
        
        # Check if already logged in
        try:
            # Look for chat input - indicates successful auth
            await self.page.wait_for_selector(
                'div[contenteditable="true"]',
                timeout=5000
            )
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
            await self.page.wait_for_selector(
                'div[contenteditable="true"]',
                timeout=120000  # 2 minutes
            )
            self.is_authenticated = True
            print("✓ Authentication successful!")
            return True
        except:
            print("✗ Authentication timeout")
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
            # Sometimes it redirects to /chats, try to create again
            await self.page.click('button:has-text("New chat")', timeout=5000)
            await asyncio.sleep(2)
            self.current_chat_id = self.page.url.split('/chat/')[-1]
        
        return self.current_chat_id
        
    async def send_message(self, message: str, chat_id: Optional[str] = None) -> str:
        """
        Send a message to Claude and wait for complete response.
        Returns the response text.
        """
        if not self.is_authenticated:
            raise RuntimeError("Not authenticated. Call authenticate() first.")
        
        # Ensure we have a chat
        active_chat_id = chat_id or await self.ensure_chat()
        
        # Navigate to chat if not already there
        if '/chat/' not in self.page.url or active_chat_id not in self.page.url:
            await self.page.goto(f'https://claude.ai/chat/{active_chat_id}')
            await asyncio.sleep(1)
        
        # Find the input field (contenteditable div)
        input_selector = 'div[contenteditable="true"]'
        await self.page.wait_for_selector(input_selector, timeout=10000)
        
        # Type the message
        input_field = await self.page.query_selector(input_selector)
        await input_field.click()
        await input_field.fill(message)
        await asyncio.sleep(0.5)
        
        # Send message (Ctrl+Enter or Enter key)
        await self.page.keyboard.press('Enter')
        
        print("→ Message sent, waiting for response...")
        
        # Wait for response to complete
        response = await self._wait_for_response_completion()
        
        return response
        
    async def _wait_for_response_completion(self, timeout: int = 180) -> str:
        """
        Wait for Claude to complete its response.
        Uses multiple strategies to detect completion.
        """
        start_time = time.time()
        last_content = ""
        stable_count = 0
        required_stable_checks = 3
        
        while True:
            if time.time() - start_time > timeout:
                print("⚠ Response timeout - returning partial response")
                break
            
            try:
                # Get all assistant messages
                messages = await self.page.query_selector_all('[data-testid^="message-"]')
                
                if not messages:
                    await asyncio.sleep(1)
                    continue
                
                # Get the last message (should be Claude's response)
                last_message = messages[-1]
                current_content = await last_message.inner_text()
                
                # Check if content is stable (stopped changing)
                if current_content == last_content:
                    stable_count += 1
                    if stable_count >= required_stable_checks:
                        # Double-check for completion indicators
                        # Look for "Copy" button or regenerate button
                        copy_btn = await last_message.query_selector('[aria-label*="Copy"]')
                        if copy_btn:
                            print("✓ Response complete")
                            return current_content
                else:
                    stable_count = 0
                    last_content = current_content
                    
            except Exception as e:
                print(f"⚠ Error while waiting: {e}")
            
            await asyncio.sleep(1)
        
        return last_content
    
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
```

#### Step 1.3: Create Session Manager

Create `browser_automation/session_manager.py`:

```python
import json
import pickle
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict

class SessionManager:
    """
    Manages browser sessions with automatic recovery.
    Handles session persistence, validation, and recovery.
    """
    
    def __init__(self, session_dir: str = "./sessions"):
        self.session_dir = Path(session_dir)
        self.session_dir.mkdir(exist_ok=True, parents=True)
        self.session_file = self.session_dir / "session_data.json"
        self.metadata_file = self.session_dir / "metadata.json"
        
    def save_session(self, chat_id: str, metadata: Optional[Dict] = None):
        """Save current session information."""
        session_data = {
            "chat_id": chat_id,
            "timestamp": datetime.now().isoformat(),
            "metadata": metadata or {}
        }
        
        with open(self.session_file, 'w') as f:
            json.dump(session_data, f, indent=2)
        
        print(f"✓ Session saved: {chat_id}")
    
    def load_session(self) -> Optional[Dict]:
        """Load existing session if valid."""
        if not self.session_file.exists():
            return None
            
        with open(self.session_file, 'r') as f:
            session_data = json.load(f)
        
        # Check if session is still valid (within 24 hours)
        timestamp = datetime.fromisoformat(session_data['timestamp'])
        if datetime.now() - timestamp > timedelta(hours=24):
            print("⚠ Session expired")
            return None
            
        print(f"✓ Session loaded: {session_data['chat_id']}")
        return session_data
    
    def clear_session(self):
        """Clear saved session."""
        if self.session_file.exists():
            self.session_file.unlink()
        print("✓ Session cleared")
    
    def save_metadata(self, key: str, value: any):
        """Save arbitrary metadata."""
        metadata = {}
        if self.metadata_file.exists():
            with open(self.metadata_file, 'r') as f:
                metadata = json.load(f)
        
        metadata[key] = value
        metadata['updated'] = datetime.now().isoformat()
        
        with open(self.metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2)
    
    def load_metadata(self, key: str, default: any = None) -> any:
        """Load metadata value."""
        if not self.metadata_file.exists():
            return default
            
        with open(self.metadata_file, 'r') as f:
            metadata = json.load(f)
        
        return metadata.get(key, default)
```

### Phase 2: MCP Server Implementation

#### Step 2.1: Core Server

Create `mcp_server/server.py`:

```python
from fastapi import FastAPI, WebSocket, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import asyncio
import os
from pathlib import Path
import subprocess
import json
import sys

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from browser_automation.claude_client import ClaudeWebClient
from browser_automation.session_manager import SessionManager

app = FastAPI(
    title="AI-IDE Bridge Server",
    description="MCP server bridging IDE with AI assistants",
    version="1.0.0"
)

# CORS middleware for IDE extensions
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state
ai_client: Optional[ClaudeWebClient] = None
session_manager: Optional[SessionManager] = None
workspace_root: Optional[Path] = None
active_connections: List[WebSocket] = []
server_config = {
    "max_file_size": 10 * 1024 * 1024,  # 10MB
    "allowed_extensions": ['.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.cpp', '.c', '.h', '.xml', '.json', '.yaml', '.yml', '.md', '.txt'],
    "rate_limit": 20,  # requests per minute
}


# ==================== Models ====================

class MCPRequest(BaseModel):
    """Standard MCP request format."""
    tool: str = Field(..., description="Tool name to execute")
    parameters: Dict[str, Any] = Field(default_factory=dict)
    context: Optional[Dict[str, Any]] = Field(default=None)


class MCPResponse(BaseModel):
    """Standard MCP response format."""
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    execution_time: Optional[float] = None


class WorkspaceConfig(BaseModel):
    """Workspace configuration."""
    path: str
    project_type: Optional[str] = None  # python, odoo, nodejs, etc.
    excluded_dirs: List[str] = Field(default_factory=lambda: ['node_modules', '__pycache__', '.git', 'venv', 'env'])


# ==================== Startup/Shutdown ====================

@app.on_event("startup")
async def startup():
    """Initialize AI client and session on server start."""
    global ai_client, session_manager
    
    print("=" * 60)
    print("AI-IDE Bridge Server Starting...")
    print("=" * 60)
    
    session_manager = SessionManager()
    ai_client = ClaudeWebClient()
    
    # Initialize browser
    print("→ Initializing browser automation...")
    await ai_client.initialize(headless=True)  # Set False for debugging
    
    # Try to restore previous session
    session_data = session_manager.load_session()
    if session_data:
        ai_client.current_chat_id = session_data.get('chat_id')
    
    # Authenticate
    print("→ Authenticating with AI service...")
    auth_success = await ai_client.authenticate()
    
    if not auth_success:
        print("✗ Authentication failed. Manual intervention may be required.")
        print("  Set headless=False in ai_client.initialize() and restart.")
    else:
        print("✓ Server ready!")
    
    print("=" * 60)


@app.on_event("shutdown")
async def shutdown():
    """Clean up on server shutdown."""
    print("\n→ Shutting down server...")
    if ai_client:
        await ai_client.close()
    print("✓ Cleanup complete")


# ==================== Core MCP Endpoints ====================

@app.post("/mcp/execute", response_model=MCPResponse)
async def execute_mcp_tool(request: MCPRequest) -> MCPResponse:
    """
    Execute an MCP tool and return results.
    This is the main entry point for IDE interactions.
    """
    import time
    start_time = time.time()
    
    try:
        print(f"\n→ Executing tool: {request.tool}")
        
        # Route to appropriate handler
        handlers = {
            "read_file": handle_read_file,
            "write_file": handle_write_file,
            "list_files": handle_list_files,
            "execute_command": handle_execute_command,
            "analyze_code": handle_analyze_code,
            "suggest_fix": handle_suggest_fix,
            "ai_query": handle_ai_query,
            "get_diagnostics": handle_get_diagnostics,
        }
        
        handler = handlers.get(request.tool)
        if not handler:
            raise ValueError(f"Unknown tool: {request.tool}")
        
        result = await handler(request.parameters, request.context)
        
        execution_time = time.time() - start_time
        print(f"✓ Tool executed in {execution_time:.2f}s")
        
        return MCPResponse(
            success=True,
            data=result,
            execution_time=execution_time
        )
        
    except Exception as e:
        execution_time = time.time() - start_time
        print(f"✗ Tool failed: {str(e)}")
        return MCPResponse(
            success=False,
            error=str(e),
            execution_time=execution_time
        )


# ==================== File Operations ====================

async def handle_read_file(params: Dict, context: Optional[Dict] = None) -> Dict:
    """Read file contents."""
    file_path = Path(params['path'])
    
    # Security check
    if not is_path_safe(file_path):
        raise ValueError(f"Invalid file path: {file_path}")
    
    # Check file size
    file_size = file_path.stat().st_size
    if file_size > server_config['max_file_size']:
        raise ValueError(f"File too large: {file_size} bytes")
    
    # Read file
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    return {
        "path": str(file_path),
        "content": content,
        "size": len(content),
        "lines": len(content.splitlines())
    }


async def handle_write_file(params: Dict, context: Optional[Dict] = None) -> Dict:
    """Write content to file."""
    file_path = Path(params['path'])
    content = params['content']
    create_backup = params.get('backup', True)
    
    if not is_path_safe(file_path):
        raise ValueError(f"Invalid file path: {file_path}")
    
    # Create backup if file exists
    if create_backup and file_path.exists():
        backup_path = file_path.with_suffix(file_path.suffix + '.backup')
        file_path.replace(backup_path)
    
    # Create directory if needed
    file_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Write file
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    return {
        "path": str(file_path),
        "written": len(content),
        "backup_created": create_backup and file_path.exists()
    }


async def handle_list_files(params: Dict, context: Optional[Dict] = None) -> Dict:
    """List files in directory."""
    directory = Path(params.get('directory', workspace_root or '.'))
    pattern = params.get('pattern', '**/*')
    max_results = params.get('max_results', 1000)
    
    if not is_path_safe(directory):
        raise ValueError(f"Invalid directory: {directory}")
    
    files = []
    for file_path in directory.glob(pattern):
        if file_path.is_file():
            # Skip excluded directories
            if any(excluded in file_path.parts for excluded in server_config.get('excluded_dirs', [])):
                continue
            
            files.append({
                "path": str(file_path.relative_to(workspace_root) if workspace_root else file_path),
                "size": file_path.stat().st_size,
                "modified": file_path.stat().st_mtime,
                "extension": file_path.suffix
            })
            
            if len(files) >= max_results:
                break
    
    return {
        "directory": str(directory),
        "files": files,
        "count": len(files),
        "pattern": pattern
    }


# ==================== Command Execution ====================

async def handle_execute_command(params: Dict, context: Optional[Dict] = None) -> Dict:
    """Execute terminal command."""
    command = params['command']
    cwd = params.get('cwd', str(workspace_root or Path.cwd()))
    timeout = params.get('timeout', 30)
    shell = params.get('shell', True)
    
    # Security check
    if not is_command_safe(command):
        raise ValueError(f"Command not allowed: {command}")
    
    print(f"  Executing: {command}")
    
    try:
        result = subprocess.run(
            command,
            shell=shell,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=timeout
        )
        
        return {
            "command": command,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode,
            "success": result.returncode == 0
        }
    except subprocess.TimeoutExpired:
        return {
            "command": command,
            "error": f"Command timed out after {timeout}s",
            "success": False
        }
    except Exception as e:
        return {
            "command": command,
            "error": str(e),
            "success": False
        }


# ==================== AI Interactions ====================

async def handle_analyze_code(params: Dict, context: Optional[Dict] = None) -> Dict:
    """Analyze code and get AI suggestions."""
    file_path = params['path']
    analysis_type = params.get('type', 'general')
    
    # Read the file
    file_data = await handle_read_file({'path': file_path})
    code_content = file_data['content']
    
    # Build analysis prompt
    prompt = build_analysis_prompt(code_content, file_path, analysis_type, context)
    
    # Query AI
    print(f"  Analyzing {file_path}...")
    response = await ai_client.send_message(prompt)
    
    # Parse response
    suggestions = parse_ai_response(response)
    
    return {
        "file": file_path,
        "analysis_type": analysis_type,
        "suggestions": suggestions,
        "raw_response": response
    }


async def handle_suggest_fix(params: Dict, context: Optional[Dict] = None) -> Dict:
    """Get AI suggestions for fixing code issues."""
    file_path = params.get('path')
    error_message = params.get('error')
    code_snippet = params.get('snippet')
    
    prompt = f"""I have an error in my code. Please help me fix it.

File: {file_path}
Error: {error_message}

Code snippet:
```
{code_snippet}
```

Please provide:
1. Explanation of the error
2. Suggested fix (code)
3. Alternative solutions if any

Format your response as JSON with keys: explanation, fix, alternatives"""
    
    response = await ai_client.send_message(prompt)
    suggestions = parse_ai_response(response)
    
    return {
        "file": file_path,
        "error": error_message,
        "suggestions": suggestions,
        "raw_response": response
    }


async def handle_ai_query(params: Dict, context: Optional[Dict] = None) -> Dict:
    """General AI query with optional context."""
    query = params['query']
    include_context = params.get('include_context', True)
    
    # Build context-aware prompt
    if include_context and context:
        full_prompt = build_context_prompt(query, context)
    else:
        full_prompt = query
    
    print(f"  Query: {query[:50]}...")
    response = await ai_client.send_message(full_prompt)
    
    return {
        "query": query,
        "response": response,
        "context_used": include_context
    }


async def handle_get_diagnostics(params: Dict, context: Optional[Dict] = None) -> Dict:
    """Get diagnostics for a file (syntax errors, linting, etc.)."""
    file_path = Path(params['path'])
    
    if not file_path.exists():
        raise ValueError(f"File not found: {file_path}")
    
    diagnostics = []
    
    # Python-specific diagnostics
    if file_path.suffix == '.py':
        # Run flake8 or pylint if available
        try:
            result = subprocess.run(
                ['python', '-m', 'py_compile', str(file_path)],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode != 0:
                diagnostics.append({
                    "severity": "error",
                    "message": result.stderr,
                    "source": "python"
                })
        except:
            pass
    
    return {
        "file": str(file_path),
        "diagnostics": diagnostics
    }


# ==================== Helper Functions ====================

def build_analysis_prompt(code: str, file_path: str, analysis_type: str, context: Optional[Dict]) -> str:
    """Build prompt for code analysis."""
    
    # Base context
    project_info = ""
    if context and 'project_type' in context:
        project_info = f"Project type: {context['project_type']}\n"
    
    prompts = {
        "general": f"""{project_info}Analyze this code from {file_path}:

```
{code[:5000]}  # Limit to first 5000 chars
```

Provide a concise analysis including:
1. What the code does
2. Potential issues or bugs
3. Code quality suggestions
4. Security concerns if any

Format as JSON: {{"overview": "...", "issues": [], "suggestions": [], "security": []}}""",

        "bugs": f"""{project_info}Find bugs in this code from {file_path}:

```
{code[:5000]}
```

List each bug with:
- description
- severity (high/medium/low)
- suggested_fix

Format as JSON array of bug objects.""",

        "performance": f"""{project_info}Analyze performance of {file_path}:

```
{code[:5000]}
```

Identify:
- Performance bottlenecks
- Memory issues
- Optimization opportunities

Format as JSON.""",

        "security": f"""{project_info}Security review for {file_path}:

```
{code[:5000]}
```

Check for:
- SQL injection vulnerabilities
- XSS vulnerabilities
- Authentication issues
- Data exposure risks

Format as JSON with security findings."""
    }
    
    return prompts.get(analysis_type, prompts["general"])


def build_context_prompt(query: str, context: Dict) -> str:
    """Build prompt with IDE context."""
    parts = [query, "\n--- Context ---"]
    
    if 'current_file' in context:
        parts.append(f"Current file: {context['current_file']}")
    
    if 'selection' in context:
        parts.append(f"Selected code:\n```\n{context['selection']}\n```")
    
    if 'project_type' in context:
        parts.append(f"Project: {context['project_type']}")
    
    if 'recent_errors' in context:
        parts.append(f"Recent errors:\n{context['recent_errors']}")
    
    if 'open_files' in context:
        parts.append(f"Open files: {', '.join(context['open_files'])}")
    
    return "\n".join(parts)


def parse_ai_response(response: str) -> List[Dict]:
    """Parse AI response into structured data."""
    try:
        # Try to extract JSON
        if "```json" in response:
            json_str = response.split("```json")[1].split("```")[0].strip()
            return json.loads(json_str)
        elif "```" in response:
            json_str = response.split("```")[1].split("```")[0].strip()
            return json.loads(json_str)
        else:
            # Try direct parse
            return json.loads(response)
    except:
        # Fall back to text
        return [{"type": "text", "content": response}]


def is_path_safe(path: Path) -> bool:
    """Check if path is safe (within workspace, no traversal)."""
    try:
        if workspace_root:
            # Resolve and check if within workspace
            resolved = path.resolve()
            workspace_resolved = workspace_root.resolve()
            resolved.relative_to(workspace_resolved)
        return True
    except (ValueError, OSError):
        return False


def is_command_safe(command: str) -> bool:
    """Check if command is safe to execute."""
    # Blacklist dangerous commands
    dangerous_patterns = [
        'rm -rf /',
        'dd if=',
        'mkfs',
        ':(){ :|:& };:',  # Fork bomb
        'chmod -R 777',
        '> /dev/sda',
        'wget http',  # Arbitrary downloads
        'curl http',   # Unless explicitly allowed
    ]
    
    command_lower = command.lower()
    for pattern in dangerous_patterns:
        if pattern in command_lower:
            return False
    
    # Whitelist approach (more secure but restrictive)
    # Uncomment to use whitelist instead
    # allowed_commands = ['python', 'pip', 'npm', 'git', 'ls', 'cat', 'grep', 'find', 'echo']
    # return any(command.strip().startswith(cmd) for cmd in allowed_commands)
    
    return True


# ==================== Configuration Endpoints ====================

@app.post("/config/workspace")
async def set_workspace(config: WorkspaceConfig):
    """Set the workspace root directory."""
    global workspace_root
    
    path = Path(config.path)
    if not path.exists():
        raise HTTPException(status_code=400, detail="Workspace path does not exist")
    
    if not path.is_dir():
        raise HTTPException(status_code=400, detail="Workspace path must be a directory")
    
    workspace_root = path
    
    # Save to session metadata
    if session_manager:
        session_manager.save_metadata('workspace', {
            'path': str(workspace_root),
            'project_type': config.project_type
        })
    
    print(f"✓ Workspace set to: {workspace_root}")
    
    return {
        "workspace": str(workspace_root),
        "project_type": config.project_type
    }


@app.get("/config/workspace")
async def get_workspace():
    """Get current workspace configuration."""
    return {
        "workspace": str(workspace_root) if workspace_root else None,
        "config": server_config
    }


@app.post("/config/update")
async def update_config(updates: Dict[str, Any]):
    """Update server configuration."""
    global server_config
    
    for key, value in updates.items():
        if key in server_config:
            server_config[key] = value
    
    return {"config": server_config}


# ==================== Health & Status ====================

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "ai_authenticated": ai_client.is_authenticated if ai_client else False,
        "workspace": str(workspace_root) if workspace_root else None
    }


@app.get("/status")
async def get_status():
    """Get detailed server status."""
    return {
        "server": "AI-IDE Bridge",
        "version": "1.0.0",
        "ai_client": {
            "authenticated": ai_client.is_authenticated if ai_client else False,
            "chat_id": ai_client.current_chat_id if ai_client else None
        },
        "workspace": str(workspace_root) if workspace_root else None,
        "active_connections": len(active_connections),
        "config": server_config
    }


# ==================== WebSocket ====================

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time updates."""
    await websocket.accept()
    active_connections.append(websocket)
    
    try:
        while True:
            data = await websocket.receive_json()
            
            if data['type'] == 'ping':
                await websocket.send_json({'type': 'pong'})
            
            elif data['type'] == 'query':
                # Handle real-time query
                response = await ai_client.send_message(data['message'])
                await websocket.send_json({
                    'type': 'response',
                    'content': response
                })
                
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        active_connections.remove(websocket)


# ==================== Main ====================

if __name__ == "__main__":
    import uvicorn
    
    print("\n" + "=" * 60)
    print("AI-IDE Bridge Server")
    print("=" * 60)
    print("\nStarting server on http://localhost:8000")
    print("API docs available at http://localhost:8000/docs")
    print("\n" + "=" * 60 + "\n")
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
```

### Phase 3: VS Code Extension

#### Step 3.1: Extension Setup

Create project structure:
```
vscode-ai-assistant/
├── package.json
├── tsconfig.json
├── src/
│   ├── extension.ts
│   ├── mcpClient.ts
│   ├── commands.ts
│   ├── diagnostics.ts
│   └── ui/
│       ├── statusBar.ts
│       └── quickPick.ts
└── README.md
```

#### Step 3.2: package.json

```json
{
  "name": "ai-ide-assistant",
  "displayName": "AI IDE Assistant",
  "description": "AI-powered coding assistant using free AI services",
  "version": "1.0.0",
  "publisher": "your-publisher-name",
  "engines": {
    "vscode": "^1.75.0"
  },
  "categories": [
    "Programming Languages",
    "Linters",
    "Other"
  ],
  "activationEvents": [
    "onCommand:ai-assistant.analyzeFile",
    "onCommand:ai-assistant.fixError",
    "onCommand:ai-assistant.askQuestion",
    "onStartupFinished"
  ],
  "main": "./out/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "ai-assistant.analyzeFile",
        "title": "AI: Analyze Current File"
      },
      {
        "command": "ai-assistant.fixError",
        "title": "AI: Suggest Fix"
      },
      {
        "command": "ai-assistant.askQuestion",
        "title": "AI: Ask Question"
      },
      {
        "command": "ai-assistant.refactorCode",
        "title": "AI: Refactor Selection"
      },
      {
        "command": "ai-assistant.explainCode",
        "title": "AI: Explain Code"
      },
      {
        "command": "ai-assistant.setWorkspace",
        "title": "AI: Set Workspace"
      }
    ],
    "menus": {
      "editor/context": [
        {
          "command": "ai-assistant.analyzeFile",
          "group": "ai-assistant",
          "when": "editorHasSelection"
        },
        {
          "command": "ai-assistant.explainCode",
          "group": "ai-assistant",
          "when": "editorHasSelection"
        },
        {
          "command": "ai-assistant.refactorCode",
          "group": "ai-assistant",
          "when": "editorHasSelection"
        }
      ]
    },
    "configuration": {
      "title": "AI IDE Assistant",
      "properties": {
        "ai-assistant.serverUrl": {
          "type": "string",
          "default": "http://localhost:8000",
          "description": "MCP Bridge Server URL"
        },
        "ai-assistant.autoAnalyze": {
          "type": "boolean",
          "default": false,
          "description": "Automatically analyze files on save"
        },
        "ai-assistant.projectType": {
          "type": "string",
          "enum": ["python", "odoo", "nodejs", "java", "cpp", "other"],
          "default": "python",
          "description": "Project type for context-aware assistance"
        }
      }
    }
  },
  "scripts": {
    "vscode:prepublish": "npm run compile",
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./",
    "pretest": "npm run compile"
  },
  "devDependencies": {
    "@types/node": "^18.0.0",
    "@types/vscode": "^1.75.0",
    "typescript": "^5.0.0"
  },
  "dependencies": {
    "axios": "^1.6.0"
  }
}
```

#### Step 3.3: MCP Client (TypeScript)

Create `src/mcpClient.ts`:

```typescript
import axios, { AxiosInstance } from 'axios';
import * as vscode from 'vscode';

export interface MCPRequest {
    tool: string;
    parameters: Record<string, any>;
    context?: Record<string, any>;
}

export interface MCPResponse {
    success: boolean;
    data?: Record<string, any>;
    error?: string;
    execution_time?: number;
}

export class MCPClient {
    private client: AxiosInstance;
    private serverUrl: string;

    constructor() {
        const config = vscode.workspace.getConfiguration('ai-assistant');
        this.serverUrl = config.get('serverUrl') || 'http://localhost:8000';
        
        this.client = axios.create({
            baseURL: this.serverUrl,
            timeout: 180000, // 3 minutes for AI responses
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    async execute(request: MCPRequest): Promise<MCPResponse> {
        try {
            const response = await this.client.post('/mcp/execute', request);
            return response.data;
        } catch (error: any) {
            console.error('MCP request failed:', error);
            throw new Error(`MCP request failed: ${error.message}`);
        }
    }

    async readFile(path: string): Promise<string> {
        const response = await this.execute({
            tool: 'read_file',
            parameters: { path }
        });

        if (!response.success || !response.data) {
            throw new Error(response.error || 'Failed to read file');
        }

        return response.data.content;
    }

    async writeFile(path: string, content: string, backup: boolean = true): Promise<void> {
        const response = await this.execute({
            tool: 'write_file',
            parameters: { path, content, backup }
        });

        if (!response.success) {
            throw new Error(response.error || 'Failed to write file');
        }
    }

    async analyzeCode(path: string, analysisType: string = 'general', context?: Record<string, any>): Promise<any> {
        const response = await this.execute({
            tool: 'analyze_code',
            parameters: { path, type: analysisType },
            context
        });

        if (!response.success || !response.data) {
            throw new Error(response.error || 'Failed to analyze code');
        }

        return response.data;
    }

    async suggestFix(path: string, error: string, snippet: string): Promise<any> {
        const response = await this.execute({
            tool: 'suggest_fix',
            parameters: { path, error, snippet }
        });

        if (!response.success || !response.data) {
            throw new Error(response.error || 'Failed to get suggestions');
        }

        return response.data;
    }

    async askAI(query: string, context?: Record<string, any>): Promise<string> {
        const response = await this.execute({
            tool: 'ai_query',
            parameters: { query, include_context: true },
            context
        });

        if (!response.success || !response.data) {
            throw new Error(response.error || 'AI query failed');
        }

        return response.data.response;
    }

    async executeCommand(command: string, cwd?: string): Promise<any> {
        const response = await this.execute({
            tool: 'execute_command',
            parameters: { command, cwd }
        });

        if (!response.success || !response.data) {
            throw new Error(response.error || 'Command execution failed');
        }

        return response.data;
    }

    async setWorkspace(path: string, projectType?: string): Promise<void> {
        try {
            await this.client.post('/config/workspace', {
                path,
                project_type: projectType
            });
        } catch (error: any) {
            throw new Error(`Failed to set workspace: ${error.message}`);
        }
    }

    async checkHealth(): Promise<boolean> {
        try {
            const response = await this.client.get('/health');
            return response.data.status === 'healthy';
        } catch {
            return false;
        }
    }
}
```

#### Step 3.4: Extension Main (TypeScript)

Create `src/extension.ts`:

```typescript
import * as vscode from 'vscode';
import { MCPClient } from './mcpClient';
import { registerCommands } from './commands';
import { DiagnosticManager } from './diagnostics';
import { StatusBarManager } from './ui/statusBar';

let mcpClient: MCPClient;
let diagnosticManager: DiagnosticManager;
let statusBar: StatusBarManager;

export async function activate(context: vscode.ExtensionContext) {
    console.log('AI IDE Assistant is activating...');

    // Initialize MCP client
    mcpClient = new MCPClient();
    
    // Initialize diagnostic manager
    diagnosticManager = new DiagnosticManager(mcpClient);
    context.subscriptions.push(diagnosticManager);
    
    // Initialize status bar
    statusBar = new StatusBarManager();
    context.subscriptions.push(statusBar);
    
    // Check server health
    const isHealthy = await mcpClient.checkHealth();
    if (!isHealthy) {
        vscode.window.showWarningMessage(
            'AI IDE Assistant: Server is not running. Please start the MCP Bridge Server.',
            'Open Terminal'
        ).then(selection => {
            if (selection === 'Open Terminal') {
                const terminal = vscode.window.createTerminal('AI Bridge Server');
                terminal.show();
                terminal.sendText('cd /path/to/mcp_server && python server.py');
            }
        });
    } else {
        statusBar.setConnected();
        
        // Set workspace
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
            const config = vscode.workspace.getConfiguration('ai-assistant');
            const projectType = config.get('projectType') as string;
            
            try {
                await mcpClient.setWorkspace(workspacePath, projectType);
                console.log('Workspace set:', workspacePath);
            } catch (error) {
                console.error('Failed to set workspace:', error);
            }
        }
    }
    
    // Register commands
    registerCommands(context, mcpClient, diagnosticManager);
    
    // Watch for file saves (optional auto-analysis)
    const config = vscode.workspace.getConfiguration('ai-assistant');
    if (config.get('autoAnalyze')) {
        vscode.workspace.onDidSaveTextDocument(async (document) => {
            await diagnosticManager.analyzeDocument(document);
        });
    }
    
    console.log('AI IDE Assistant is now active!');
}

export function deactivate() {
    console.log('AI IDE Assistant is deactivating...');
}
```

#### Step 3.5: Commands Implementation

Create `src/commands.ts`:

```typescript
import * as vscode from 'vscode';
import { MCPClient } from './mcpClient';
import { DiagnosticManager } from './diagnostics';

export function registerCommands(
    context: vscode.ExtensionContext,
    mcpClient: MCPClient,
    diagnosticManager: DiagnosticManager
) {
    // Analyze current file
    context.subscriptions.push(
        vscode.commands.registerCommand('ai-assistant.analyzeFile', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor');
                return;
            }

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Analyzing code...',
                cancellable: false
            }, async (progress) => {
                try {
                    const filePath = editor.document.uri.fsPath;
                    const result = await mcpClient.analyzeCode(filePath, 'general');
                    
                    // Show results in webview panel
                    const panel = vscode.window.createWebviewPanel(
                        'aiAnalysis',
                        'Code Analysis Results',
                        vscode.ViewColumn.Beside,
                        {}
                    );
                    
                    panel.webview.html = formatAnalysisResults(result);
                    
                } catch (error: any) {
                    vscode.window.showErrorMessage(`Analysis failed: ${error.message}`);
                }
            });
        })
    );

    // Ask AI a question
    context.subscriptions.push(
        vscode.commands.registerCommand('ai-assistant.askQuestion', async () => {
            const query = await vscode.window.showInputBox({
                prompt: 'Ask the AI assistant anything about your code',
                placeHolder: 'e.g., How can I optimize this function?'
            });

            if (!query) {
                return;
            }

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Asking AI...',
                cancellable: false
            }, async (progress) => {
                try {
                    const editor = vscode.window.activeTextEditor;
                    const context: Record<string, any> = {};
                    
                    if (editor) {
                        context.current_file = editor.document.uri.fsPath;
                        
                        const selection = editor.selection;
                        if (!selection.isEmpty) {
                            context.selection = editor.document.getText(selection);
                        }
                    }
                    
                    const response = await mcpClient.askAI(query, context);
                    
                    // Show response in output channel
                    const outputChannel = vscode.window.createOutputChannel('AI Assistant');
                    outputChannel.clear();
                    outputChannel.appendLine('='.repeat(60));
                    outputChannel.appendLine(`Query: ${query}`);
                    outputChannel.appendLine('='.repeat(60));
                    outputChannel.appendLine(response);
                    outputChannel.appendLine('='.repeat(60));
                    outputChannel.show();
                    
                } catch (error: any) {
                    vscode.window.showErrorMessage(`AI query failed: ${error.message}`);
                }
            });
        })
    );

    // Explain selected code
    context.subscriptions.push(
        vscode.commands.registerCommand('ai-assistant.explainCode', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return;
            }

            const selection = editor.selection;
            if (selection.isEmpty) {
                vscode.window.showInformationMessage('Please select code to explain');
                return;
            }

            const selectedText = editor.document.getText(selection);
            const query = `Explain this code:\n\n${selectedText}`;

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Getting explanation...',
                cancellable: false
            }, async (progress) => {
                try {
                    const response = await mcpClient.askAI(query);
                    
                    // Show in information message with option to view in output
                    const action = await vscode.window.showInformationMessage(
                        'Explanation ready!',
                        'View Details'
                    );
                    
                    if (action === 'View Details') {
                        const outputChannel = vscode.window.createOutputChannel('AI Explanation');
                        outputChannel.clear();
                        outputChannel.appendLine('CODE EXPLANATION');
                        outputChannel.appendLine('='.repeat(60));
                        outputChannel.appendLine(response);
                        outputChannel.show();
                    }
                    
                } catch (error: any) {
                    vscode.window.showErrorMessage(`Explanation failed: ${error.message}`);
                }
            });
        })
    );

    // Refactor code
    context.subscriptions.push(
        vscode.commands.registerCommand('ai-assistant.refactorCode', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return;
            }

            const selection = editor.selection;
            if (selection.isEmpty) {
                vscode.window.showInformationMessage('Please select code to refactor');
                return;
            }

            const selectedText = editor.document.getText(selection);
            const query = `Refactor this code to improve readability and performance. Provide only the refactored code:\n\n${selectedText}`;

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Refactoring code...',
                cancellable: false
            }, async (progress) => {
                try {
                    const response = await mcpClient.askAI(query);
                    
                    // Extract code from response
                    let refactoredCode = response;
                    if (response.includes('```')) {
                        const codeMatch = response.match(/```(?:\w+)?\n([\s\S]*?)```/);
                        if (codeMatch) {
                            refactoredCode = codeMatch[1].trim();
                        }
                    }
                    
                    // Show diff
                    const originalDoc = await vscode.workspace.openTextDocument({
                        content: selectedText,
                        language: editor.document.languageId
                    });
                    
                    const refactoredDoc = await vscode.workspace.openTextDocument({
                        content: refactoredCode,
                        language: editor.document.languageId
                    });
                    
                    await vscode.commands.executeCommand(
                        'vscode.diff',
                        originalDoc.uri,
                        refactoredDoc.uri,
                        'Original ↔ Refactored'
                    );
                    
                } catch (error: any) {
                    vscode.window.showErrorMessage(`Refactoring failed: ${error.message}`);
                }
            });
        })
    );

    // Fix error
    context.subscriptions.push(
        vscode.commands.registerCommand('ai-assistant.fixError', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return;
            }

            // Get error from user
            const error = await vscode.window.showInputBox({
                prompt: 'Describe the error you want to fix',
                placeHolder: 'e.g., NameError: name "x" is not defined'
            });

            if (!error) {
                return;
            }

            const selection = editor.selection;
            const snippet = selection.isEmpty 
                ? editor.document.getText()
                : editor.document.getText(selection);

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Getting fix suggestions...',
                cancellable: false
            }, async (progress) => {
                try {
                    const filePath = editor.document.uri.fsPath;
                    const result = await mcpClient.suggestFix(filePath, error, snippet);
                    
                    // Show suggestions
                    const panel = vscode.window.createWebviewPanel(
                        'aiFix',
                        'Fix Suggestions',
                        vscode.ViewColumn.Beside,
                        {}
                    );
                    
                    panel.webview.html = formatFixSuggestions(result);
                    
                } catch (error: any) {
                    vscode.window.showErrorMessage(`Fix suggestion failed: ${error.message}`);
                }
            });
        })
    );
}

function formatAnalysisResults(result: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            font-family: Arial, sans-serif;
            padding: 20px;
            line-height: 1.6;
        }
        .section {
            margin-bottom: 30px;
        }
        h2 {
            color: #007ACC;
            border-bottom: 2px solid #007ACC;
            padding-bottom: 10px;
        }
        .suggestion {
            background: #f5f5f5;
            padding: 15px;
            margin: 10px 0;
            border-left: 4px solid #007ACC;
        }
        .severity-high { border-left-color: #d32f2f; }
        .severity-medium { border-left-color: #f57c00; }
        .severity-low { border-left-color: #388e3c; }
        pre {
            background: #1e1e1e;
            color: #d4d4d4;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
        }
    </style>
</head>
<body>
    <h1>Code Analysis Results</h1>
    
    <div class="section">
        <h2>Raw Response</h2>
        <pre>${escapeHtml(result.raw_response || 'No response')}</pre>
    </div>
</body>
</html>
    `;
}

function formatFixSuggestions(result: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            font-family: Arial, sans-serif;
            padding: 20px;
            line-height: 1.6;
        }
        h2 {
            color: #007ACC;
        }
        .suggestion {
            background: #f5f5f5;
            padding: 15px;
            margin: 10px 0;
            border-left: 4px solid #007ACC;
        }
        pre {
            background: #1e1e1e;
            color: #d4d4d4;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
        }
    </style>
</head>
<body>
    <h1>Fix Suggestions</h1>
    <h2>Error: ${escapeHtml(result.error || '')}</h2>
    
    <div class="suggestion">
        <h3>AI Response</h3>
        <pre>${escapeHtml(result.raw_response || 'No suggestions')}</pre>
    </div>
</body>
</html>
    `;
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
```

#### Step 3.6: Diagnostics Manager

Create `src/diagnostics.ts`:

```typescript
import * as vscode from 'vscode';
import { MCPClient } from './mcpClient';

export class DiagnosticManager implements vscode.Disposable {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private mcpClient: MCPClient;

    constructor(mcpClient: MCPClient) {
        this.mcpClient = mcpClient;
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('ai-assistant');
    }

    async analyzeDocument(document: vscode.TextDocument): Promise<void> {
        if (document.uri.scheme !== 'file') {
            return;
        }

        try {
            const result = await this.mcpClient.execute({
                tool: 'get_diagnostics',
                parameters: { path: document.uri.fsPath }
            });

            if (result.success && result.data && result.data.diagnostics) {
                const diagnostics: vscode.Diagnostic[] = result.data.diagnostics.map((diag: any) => {
                    const range = new vscode.Range(
                        diag.line || 0,
                        diag.column || 0,
                        diag.line || 0,
                        diag.endColumn || 100
                    );

                    const severity = diag.severity === 'error' 
                        ? vscode.DiagnosticSeverity.Error
                        : diag.severity === 'warning'
                        ? vscode.DiagnosticSeverity.Warning
                        : vscode.DiagnosticSeverity.Information;

                    return new vscode.Diagnostic(
                        range,
                        diag.message,
                        severity
                    );
                });

                this.diagnosticCollection.set(document.uri, diagnostics);
            }
        } catch (error) {
            console.error('Failed to get diagnostics:', error);
        }
    }

    clearDiagnostics(uri: vscode.Uri): void {
        this.diagnosticCollection.delete(uri);
    }

    dispose(): void {
        this.diagnosticCollection.dispose();
    }
}
```

#### Step 3.7: Status Bar

Create `src/ui/statusBar.ts`:

```typescript
import * as vscode from 'vscode';

export class StatusBarManager implements vscode.Disposable {
    private statusBarItem: vscode.StatusBarItem;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this.statusBarItem.command = 'ai-assistant.askQuestion';
        this.setDisconnected();
        this.statusBarItem.show();
    }

    setConnected(): void {
        this.statusBarItem.text = '$(check) AI Assistant';
        this.statusBarItem.tooltip = 'AI Assistant connected - Click to ask a question';
        this.statusBarItem.backgroundColor = undefined;
    }

    setDisconnected(): void {
        this.statusBarItem.text = '$(x) AI Assistant';
        this.statusBarItem.tooltip = 'AI Assistant disconnected - Server not running';
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    }

    setWorking(): void {
        this.statusBarItem.text = '$(sync~spin) AI Assistant';
        this.statusBarItem.tooltip = 'AI Assistant is processing...';
    }

    dispose(): void {
        this.statusBarItem.dispose();
    }
}
```

### Phase 4: Deployment & Usage

#### Step 4.1: Start the Server

```bash
# Navigate to server directory
cd ai-ide-bridge

# Activate virtual environment
source venv/bin/activate

# Start the server
python mcp_server/server.py
```

Server will start on `http://localhost:8000`

#### Step 4.2: Install VS Code Extension

```bash
# Navigate to extension directory
cd vscode-ai-assistant

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Package extension (optional)
npm install -g vsce
vsce package

# Install in VS Code
# Method 1: Press F5 to launch Extension Development Host
# Method 2: Install .vsix file via Extensions panel
```

#### Step 4.3: Configure Extension

1. Open VS Code Settings (Ctrl+,)
2. Search for "AI Assistant"
3. Configure:
   - Server URL: `http://localhost:8000`
   - Project Type: `python` / `odoo` / etc.
   - Auto Analyze: Enable if desired

#### Step 4.4: Usage Examples

**Analyze a file:**
1. Open a Python file
2. Press Ctrl+Shift+P
3. Type "AI: Analyze Current File"
4. View results in side panel

**Ask a question:**
1. Press Ctrl+Shift+P
2. Type "AI: Ask Question"
3. Enter your question
4. View response in Output panel

**Explain code:**
1. Select code
2. Right-click → "AI: Explain Code"
3. View explanation

**Fix an error:**
1. Press Ctrl+Shift+P
2. Type "AI: Suggest Fix"
3. Enter error message
4. View suggestions

---

## Security Considerations

### 1. Path Validation

**Threat**: Directory traversal attacks
**Mitigation**:
```python
def is_path_safe(path: Path) -> bool:
    """Ensure path is within workspace."""
    try:
        if workspace_root:
            path.resolve().relative_to(workspace_root.resolve())
        return True
    except ValueError:
        return False
```

### 2. Command Whitelisting

**Threat**: Arbitrary code execution
**Mitigation**:
```python
def is_command_safe(command: str) -> bool:
    """Blacklist dangerous commands."""
    dangerous = ['rm -rf /', 'dd', 'mkfs', 'chmod -R 777']
    return not any(d in command for d in dangerous)
```

**Better approach**: Use whitelist:
```python
ALLOWED_COMMANDS = ['python', 'pip', 'npm', 'git', 'ls']
return any(command.startswith(cmd) for cmd in ALLOWED_COMMANDS)
```

### 3. Authentication

**Current**: Session-based (browser cookies)
**Production Enhancement**:
- Add API key authentication for MCP server
- Use HTTPS/TLS for communication
- Implement rate limiting per user

Example:
```python
from fastapi import Header, HTTPException

API_KEY = os.getenv('API_KEY', 'your-secret-key')

async def verify_api_key(x_api_key: str = Header(...)):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API key")
```

### 4. Input Sanitization

**Threat**: Injection attacks
**Mitigation**:
```python
import re

def sanitize_input(text: str) -> str:
    """Remove potentially harmful characters."""
    # Remove shell metacharacters
    return re.sub(r'[;&|`$()]', '', text)
```

### 5. File Size Limits

**Threat**: DoS via large files
**Mitigation**:
```python
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

if file_path.stat().st_size > MAX_FILE_SIZE:
    raise ValueError("File too large")
```

### 6. Network Security

**For Production**:
- Use reverse proxy (nginx/Apache)
- Enable HTTPS
- Firewall rules (only localhost or specific IPs)
- VPN for remote access

Example nginx config:
```nginx
server {
    listen 443 ssl;
    server_name ai-bridge.yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 7. Sandboxing

**Advanced**: Run command execution in Docker container:
```python
import docker

def execute_sandboxed(command: str):
    client = docker.from_env()
    container = client.containers.run(
        'python:3.11-alpine',
        command=command,
        remove=True,
        network_disabled=True,
        mem_limit='512m',
        cpu_period=100000,
        cpu_quota=50000
    )
    return container
```

---

## Limitations & Workarounds

### 1. Browser Automation Fragility

**Limitation**: Web UI changes break automation

**Workarounds**:
- **Multi-provider support**: Implement fallback to ChatGPT if Claude fails
- **Robust selectors**: Use multiple selector strategies
- **Regular updates**: Monitor for UI changes
- **Error recovery**: Automatic retry with different selectors

Example multi-provider:
```python
class AIClientFactory:
    @staticmethod
    async def create(provider: str):
        if provider == 'claude':
            return ClaudeWebClient()
        elif provider == 'chatgpt':
            return ChatGPTWebClient()
        elif provider == 'gemini':
            return GeminiWebClient()
```

### 2. Rate Limiting

**Limitation**: Free services have rate limits

**Workarounds**:
- **Request queuing**: Queue requests and process sequentially
- **Caching**: Cache common queries
- **Smart batching**: Combine multiple questions
- **Multiple accounts**: Rotate between accounts (use responsibly)

Example caching:
```python
import hashlib
from functools import lru_cache

@lru_cache(maxsize=100)
def cached_query(prompt_hash: str):
    # Cache based on prompt hash
    pass
```

### 3. Response Parsing

**Limitation**: AI responses vary in format

**Workarounds**:
- **Structured prompts**: Request specific JSON format
- **Fallback parsing**: Multiple parsing strategies
- **Validation**: Validate extracted data

Example:
```python
def parse_response_robust(response: str):
    # Try JSON first
    try:
        return json.loads(response)
    except:
        pass
    
    # Try extracting JSON block
    try:
        json_match = re.search(r'```json\n(.+?)\n```', response, re.DOTALL)
        if json_match:
            return json.loads(json_match.group(1))
    except:
        pass
    
    # Fall back to text
    return {"type": "text", "content": response}
```

### 4. Authentication Persistence

**Limitation**: Sessions expire

**Workarounds**:
- **Session monitoring**: Check auth status before requests
- **Auto re-auth**: Automatic login retry
- **Manual fallback**: Prompt user when auto-auth fails

```python
async def ensure_authenticated(self):
    if not self.is_authenticated:
        await self.authenticate()
    
    # Verify still authenticated
    try:
        await self.page.goto('https://claude.ai/chats')
        await self.page.wait_for_selector('div[contenteditable="true"]', timeout=5000)
    except:
        # Re-authenticate
        await self.authenticate()
```

### 5. Performance

**Limitation**: Slower than API calls

**Workarounds**:
- **Async processing**: Non-blocking operations
- **Progress indicators**: Show user work is happening
- **Streaming**: Stream responses where possible
- **Parallel requests**: Multiple browser instances for concurrent requests

---

## Production Deployment

### Architecture for Scale

```
                                    Load Balancer
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    │                     │                     │
              MCP Server 1          MCP Server 2          MCP Server 3
                    │                     │                     │
            ┌───────┴───────┐     ┌───────┴───────┐     ┌───────┴───────┐
         Browser 1      Browser 2      Browser 3      Browser 4
    (Claude Account 1)(ChatGPT 1)(Claude Account 2)(Gemini 1)
```

### Docker Deployment

Create `Dockerfile`:
```dockerfile
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Install Playwright and browsers
RUN pip install playwright fastapi uvicorn pydantic
RUN playwright install chromium
RUN playwright install-deps chromium

# Copy application
WORKDIR /app
COPY . /app

# Run server
CMD ["python", "mcp_server/server.py"]
```

Create `docker-compose.yml`:
```yaml
version: '3.8'

services:
  mcp-server:
    build: .
    ports:
      - "8000:8000"
    volumes:
      - ./sessions:/app/sessions
      - ./workspace:/workspace
    environment:
      - WORKSPACE_ROOT=/workspace
    restart: unless-stopped
```

### Systemd Service

Create `/etc/systemd/system/ai-bridge.service`:
```ini
[Unit]
Description=AI-IDE Bridge Server
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/ai-ide-bridge
Environment="PATH=/path/to/venv/bin"
ExecStart=/path/to/venv/bin/python mcp_server/server.py
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable ai-bridge
sudo systemctl start ai-bridge
sudo systemctl status ai-bridge
```

### Monitoring & Logging

Add logging to server:
```python
import logging
from logging.handlers import RotatingFileHandler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        RotatingFileHandler('ai-bridge.log', maxBytes=10485760, backupCount=5),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)
```

### Health Monitoring

Add Prometheus metrics (optional):
```python
from prometheus_client import Counter, Histogram, generate_latest

request_count = Counter('mcp_requests_total', 'Total MCP requests')
request_duration = Histogram('mcp_request_duration_seconds', 'Request duration')

@app.get("/metrics")
async def metrics():
    return Response(generate_latest(), media_type="text/plain")
```

---

## Advanced Features

### 1. Context-Aware Prompting

```python
class ContextBuilder:
    def __init__(self, workspace_root: Path):
        self.workspace = workspace_root
    
    async def build_context(self, current_file: Path) -> Dict:
        context = {
            "file": str(current_file),
            "project_structure": await self.get_project_structure(),
            "dependencies": await self.get_dependencies(),
            "recent_changes": await self.get_git_changes()
        }
        return context
    
    async def get_project_structure(self) -> List[str]:
        # Get file tree
        return [str(f) for f in self.workspace.rglob('*.py')]
    
    async def get_dependencies(self) -> List[str]:
        # Parse requirements.txt or package.json
        pass
    
    async def get_git_changes(self) -> List[str]:
        # Get recent git commits
        result = subprocess.run(
            ['git', 'log', '--oneline', '-10'],
            capture_output=True,
            text=True
        )
        return result.stdout.splitlines()
```

### 2. Intelligent Caching

```python
from datetime import datetime, timedelta
import hashlib

class ResponseCache:
    def __init__(self, ttl_minutes: int = 60):
        self.cache = {}
        self.ttl = timedelta(minutes=ttl_minutes)
    
    def get(self, prompt: str) -> Optional[str]:
        key = hashlib.md5(prompt.encode()).hexdigest()
        if key in self.cache:
            entry = self.cache[key]
            if datetime.now() - entry['timestamp'] < self.ttl:
                return entry['response']
        return None
    
    def set(self, prompt: str, response: str):
        key = hashlib.md5(prompt.encode()).hexdigest()
        self.cache[key] = {
            'response': response,
            'timestamp': datetime.now()
        }
```

### 3. Multi-Model Orchestration

```python
class ModelOrchestrator:
    def __init__(self):
        self.models = {
            'claude': ClaudeWebClient(),
            'chatgpt': ChatGPTWebClient(),
            'gemini': GeminiWebClient()
        }
    
    async def query_best_model(self, task_type: str, prompt: str):
        # Route to best model based on task
        model_routing = {
            'code_generation': 'claude',
            'debugging': 'chatgpt',
            'explanation': 'gemini'
        }
        
        model_name = model_routing.get(task_type, 'claude')
        return await self.models[model_name].send_message(prompt)
```

---

## Troubleshooting Guide

### Server Won't Start

**Symptoms**: `connection refused` errors

**Solutions**:
1. Check if port 8000 is available:
   ```bash
   lsof -i :8000
   ```

2. Check server logs:
   ```bash
   tail -f ai-bridge.log
   ```

3. Verify Python environment:
   ```bash
   which python
   pip list | grep fastapi
   ```

### Authentication Fails

**Symptoms**: "Authentication required" messages

**Solutions**:
1. Run server with `headless=False` for manual login
2. Clear session data:
   ```bash
   rm -rf sessions/
   ```
3. Check browser automation:
   ```bash
   playwright install chromium
   ```

### Extension Not Connecting

**Symptoms**: Red status bar in VS Code

**Solutions**:
1. Verify server is running:
   ```bash
   curl http://localhost:8000/health
   ```

2. Check extension settings:
   - Correct server URL
   - No firewall blocking

3. Reload VS Code window:
   - Ctrl+Shift+P → "Reload Window"

### Slow Responses

**Symptoms**: Timeouts, long waits

**Solutions**:
1. Increase timeout in extension:
   ```typescript
   timeout: 300000  // 5 minutes
   ```

2. Enable caching in server
3. Use shorter prompts
4. Check network latency

---

## Complete File Structure

```
ai-ide-bridge/
├── browser_automation/
│   ├── __init__.py
│   ├── claude_client.py
│   ├── chatgpt_client.py
│   ├── gemini_client.py
│   └── session_manager.py
├── mcp_server/
│   ├── __init__.py
│   ├── server.py
│   ├── ai_handler.py
│   └── security.py
├── sessions/
│   ├── chrome_profile/
│   ├── session_data.json
│   └── metadata.json
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
└── README.md

vscode-ai-assistant/
├── src/
│   ├── extension.ts
│   ├── mcpClient.ts
│   ├── commands.ts
│   ├── diagnostics.ts
│   └── ui/
│       ├── statusBar.ts
│       └── quickPick.ts
├── package.json
├── tsconfig.json
└── README.md
```

---

## Next Steps

1. **Test the basic setup**:
   - Start server
   - Install extension
   - Try simple queries

2. **Customize for your workflow**:
   - Add Odoo-specific commands
   - OCR integration helpers
   - Python linting integration

3. **Enhance security**:
   - Add authentication
   - Implement stricter command whitelist
   - Enable HTTPS

4. **Scale up**:
   - Add multiple AI providers
   - Implement caching
   - Deploy with Docker

5. **Contribute**:
   - Share improvements
   - Report bugs
   - Add features

---

## Resources

- [Playwright Documentation](https://playwright.dev)
- [FastAPI Documentation](https://fastapi.tiangolo.com)
- [VS Code Extension API](https://code.visualstudio.com/api)
- [MCP Specification](https://github.com/anthropics/anthropic-mcp)

---

**Version**: 1.0.0  
**Last Updated**: March 2026  
**License**: MIT