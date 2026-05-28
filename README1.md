# AI-IDE Integration System
## Zero-Cost Cloud-Based AI Assistant for IDEs

Connect your IDE to powerful AI assistants (Claude, ChatGPT, Gemini) without paying for API access!

![Architecture](https://img.shields.io/badge/Status-Production%20Ready-green)
![Python](https://img.shields.io/badge/Python-3.11%2B-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)

---

## 🎯 What This Does

This system enables AI-powered coding assistance in your IDE by:
- ✅ Using **free web-based AI services** (no API costs!)
- ✅ **Reading and modifying** files in your workspace
- ✅ **Executing terminal commands** safely
- ✅ **Analyzing code** and suggesting improvements
- ✅ **Full IDE integration** with VS Code (and others)

### Key Innovation

Instead of expensive API calls, we use **browser automation** to interact with free AI web interfaces, wrapped in a robust **MCP (Model Context Protocol)** server.

---

## 📋 Prerequisites

- **Python 3.11+**
- **Node.js 18+** (for VS Code extension)
- **VS Code** (or your preferred IDE)
- **Account** on claude.ai, chat.openai.com, or gemini.google.com

---

## 🚀 Quick Start

### Option 1: Automatic Setup

```bash
# Download and run setup script
curl -o setup.sh https://your-repo/setup.sh
chmod +x setup.sh
./setup.sh
```

### Option 2: Manual Setup

#### Step 1: Set Up Python Server

```bash
# Create project directory
mkdir ai-ide-bridge && cd ai-ide-bridge

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Install Playwright browsers
playwright install chromium
```

#### Step 2: Create Implementation Files

Create the following files in your project:

**`browser_automation/claude_client.py`** - See full implementation in architecture doc

**`mcp_server/server.py`** - See full implementation in architecture doc

#### Step 3: Start the Server

```bash
cd ai-ide-bridge
source venv/bin/activate
python mcp_server/server.py
```

Expected output:
```
============================================================
AI-IDE Bridge Server Starting...
============================================================
→ Initializing browser automation...
→ Authenticating with AI service...
✓ Server ready!
============================================================
INFO:     Uvicorn running on http://0.0.0.0:8000
```

#### Step 4: Set Up VS Code Extension

```bash
# In a new terminal
mkdir vscode-ai-assistant && cd vscode-ai-assistant

# Copy extension files (from architecture doc)
# - package.json
# - tsconfig.json
# - src/extension.ts
# - src/mcpClient.ts
# - src/commands.ts

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Launch extension
# Press F5 in VS Code to open Extension Development Host
```

---

## 💡 Usage Examples

### 1. Analyze Code

**Command Palette** → "AI: Analyze Current File"

The AI will analyze your code and provide:
- Overview of functionality
- Potential bugs
- Performance suggestions
- Security concerns

### 2. Ask Questions

**Command Palette** → "AI: Ask Question"

Example questions:
- "How can I optimize this database query?"
- "What's the time complexity of this algorithm?"
- "How do I handle errors in Odoo controllers?"

### 3. Fix Errors

**Command Palette** → "AI: Suggest Fix"

Enter the error message and get:
- Explanation of the error
- Suggested fix (with code)
- Alternative solutions

### 4. Explain Code

1. Select code
2. Right-click → "AI: Explain Code"
3. View explanation in Output panel

### 5. Refactor Code

1. Select code
2. Right-click → "AI: Refactor Selection"
3. View side-by-side diff of original vs refactored

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│           VS Code IDE                    │
│  ┌───────────────────────────────────┐  │
│  │      Extension (TypeScript)       │  │
│  │  • Commands  • Diagnostics        │  │
│  │  • Code Actions  • Status Bar     │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
                    │
                    │ HTTP/WebSocket
                    │ localhost:8000
                    ▼
┌─────────────────────────────────────────┐
│    MCP Bridge Server (Python/FastAPI)   │
│  ┌───────────────────────────────────┐  │
│  │   MCP Protocol Implementation     │  │
│  │  read_file() • write_file()       │  │
│  │  execute_command()                │  │
│  │  analyze_code() • ai_query()      │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │   AI Interaction Manager          │  │
│  │  • Context Builder                │  │
│  │  • Response Parser                │  │
│  │  • Rate Limiter                   │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
                    │
                    │ Playwright
                    │ Browser Automation
                    ▼
┌─────────────────────────────────────────┐
│    Headless Chrome Browser              │
│  ┌───────────────────────────────────┐  │
│  │  Free AI Service                  │  │
│  │  • claude.ai                      │  │
│  │  • chat.openai.com                │  │
│  │  • gemini.google.com              │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

---

## 🔧 Configuration

### Server Configuration

Edit `mcp_server/server.py`:

```python
server_config = {
    "max_file_size": 10 * 1024 * 1024,  # 10MB
    "allowed_extensions": ['.py', '.js', '.ts', ...],
    "rate_limit": 20,  # requests per minute
}
```

### VS Code Extension Settings

**File** → **Preferences** → **Settings** → Search "AI Assistant"

- **Server URL**: `http://localhost:8000` (default)
- **Project Type**: `python`, `odoo`, `nodejs`, etc.
- **Auto Analyze**: Enable/disable automatic analysis on save

### Environment Variables

Create `.env` file:

```env
# Server configuration
SERVER_HOST=0.0.0.0
SERVER_PORT=8000

# Workspace
WORKSPACE_ROOT=/path/to/your/project

# AI Provider
AI_PROVIDER=claude  # claude, chatgpt, gemini

# Security
API_KEY=your-secret-key  # Optional for production
```

---

## 🔒 Security Best Practices

### 1. Command Whitelisting

**Recommended for production**:

```python
ALLOWED_COMMANDS = [
    'python', 'pip', 'npm', 'git',
    'ls', 'cat', 'grep', 'find'
]

def is_command_safe(command: str) -> bool:
    return any(command.startswith(cmd) for cmd in ALLOWED_COMMANDS)
```

### 2. Path Validation

Always validate file paths:

```python
def is_path_safe(path: Path) -> bool:
    try:
        path.resolve().relative_to(workspace_root.resolve())
        return True
    except ValueError:
        return False
```

### 3. Authentication

Add API key authentication:

```python
from fastapi import Header, HTTPException

async def verify_api_key(x_api_key: str = Header(...)):
    if x_api_key != os.getenv('API_KEY'):
        raise HTTPException(status_code=403)
```

### 4. HTTPS in Production

Use reverse proxy (nginx):

```nginx
server {
    listen 443 ssl;
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:8000;
    }
}
```

---

## 🐛 Troubleshooting

### Server Won't Start

**Problem**: `Address already in use`

**Solution**:
```bash
# Check what's using port 8000
lsof -i :8000

# Kill the process or use different port
uvicorn server:app --port 8001
```

### Authentication Fails

**Problem**: "Authentication required" messages

**Solutions**:
1. Run with visible browser: Set `headless=False` in `claude_client.py`
2. Clear sessions: `rm -rf sessions/`
3. Manually log in when browser opens

### Extension Not Connecting

**Problem**: Red status bar in VS Code

**Solutions**:
1. Verify server is running:
   ```bash
   curl http://localhost:8000/health
   ```
2. Check VS Code settings for correct server URL
3. Reload VS Code: Ctrl+Shift+P → "Reload Window"

### Slow Responses

**Problem**: Long wait times or timeouts

**Solutions**:
1. Increase timeout in extension settings
2. Enable response caching in server
3. Use shorter, more specific prompts
4. Check your internet connection

### Playwright Browser Issues

**Problem**: Browser fails to launch

**Solutions**:
```bash
# Reinstall browsers
playwright install chromium

# Install system dependencies (Linux)
playwright install-deps chromium

# Check Playwright installation
playwright --version
```

---

## 📊 Performance Optimization

### 1. Enable Caching

Add to server:

```python
from functools import lru_cache
import hashlib

@lru_cache(maxsize=100)
def cached_query(prompt_hash: str):
    # Cache AI responses
    pass
```

### 2. Request Batching

Combine multiple questions:

```python
def batch_queries(queries: List[str]) -> str:
    combined = "Please answer the following questions:\n"
    for i, q in enumerate(queries, 1):
        combined += f"{i}. {q}\n"
    return combined
```

### 3. Parallel Processing

Use multiple browser instances:

```python
import asyncio

async def parallel_queries(prompts: List[str]):
    tasks = [client.send_message(p) for p in prompts]
    return await asyncio.gather(*tasks)
```

---

## 🚀 Advanced Features

### Multi-Provider Support

Automatically switch between AI providers:

```python
class AIOrchestrator:
    def __init__(self):
        self.providers = {
            'claude': ClaudeWebClient(),
            'chatgpt': ChatGPTWebClient(),
            'gemini': GeminiWebClient()
        }
    
    async def query(self, prompt: str, preferred: str = 'claude'):
        try:
            return await self.providers[preferred].send_message(prompt)
        except:
            # Fallback to other providers
            for name, client in self.providers.items():
                if name != preferred:
                    try:
                        return await client.send_message(prompt)
                    except:
                        continue
```

### Context-Aware Prompting

Include project context automatically:

```python
async def build_smart_context(file_path: Path):
    return {
        "current_file": str(file_path),
        "project_type": detect_project_type(),
        "dependencies": get_dependencies(),
        "recent_changes": get_git_log(),
        "related_files": find_related_files(file_path)
    }
```

### Odoo-Specific Integration

Add Odoo helpers:

```python
@app.post("/odoo/analyze-model")
async def analyze_odoo_model(model_name: str):
    """Analyze Odoo model structure."""
    prompt = f"""Analyze this Odoo model: {model_name}
    
    Review:
    1. Field definitions
    2. Compute methods
    3. Constraints
    4. Security rules
    
    Suggest improvements."""
    
    return await ai_client.send_message(prompt)
```

---

## 📦 Production Deployment

### Docker Deployment

**Dockerfile**:

```dockerfile
FROM python:3.11-slim

RUN apt-get update && apt-get install -y wget gnupg

RUN pip install playwright fastapi uvicorn pydantic
RUN playwright install chromium
RUN playwright install-deps chromium

WORKDIR /app
COPY . /app

CMD ["python", "mcp_server/server.py"]
```

**docker-compose.yml**:

```yaml
version: '3.8'

services:
  ai-bridge:
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

Start with:
```bash
docker-compose up -d
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

Enable:
```bash
sudo systemctl enable ai-bridge
sudo systemctl start ai-bridge
```

---

## 🤝 Contributing

We welcome contributions! Areas for improvement:

1. **Additional AI Providers**: Add support for more AI services
2. **IDE Support**: JetBrains, Sublime Text, Vim integrations
3. **Language Support**: Better prompts for Java, C++, Go, etc.
4. **Performance**: Caching strategies, optimization
5. **Security**: Enhanced sandboxing, auditing

---

## 📝 License

MIT License - feel free to use and modify!

---

## 🆘 Support

- **Documentation**: See `AI-IDE-Integration-Complete-Architecture.md`
- **Issues**: Open an issue on GitHub
- **Discussions**: Join our community forum

---

## 🙏 Acknowledgments

- Anthropic for Claude
- OpenAI for ChatGPT
- Google for Gemini
- Playwright team
- FastAPI team
- VS Code team

---

**Built with ❤️ for developers who want AI assistance without breaking the bank!**

---

## 📚 Additional Resources

- [Full Architecture Document](./AI-IDE-Integration-Complete-Architecture.md)
- [Playwright Documentation](https://playwright.dev)
- [FastAPI Documentation](https://fastapi.tiangulo.com)
- [VS Code Extension API](https://code.visualstudio.com/api)
- [MCP Specification](https://github.com/anthropics/anthropic-mcp)

---

**Last Updated**: March 2026  
**Version**: 1.0.0
