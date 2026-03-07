@echo off
echo ==========================================
echo AI-IDE Bridge - Quick Setup (Windows)
echo ==========================================
echo.

echo -^> Checking Python version...
python --version

echo -^> Creating project structure...
mkdir ai-ide-bridge 2>nul
cd ai-ide-bridge
mkdir browser_automation 2>nul
mkdir mcp_server 2>nul
mkdir sessions 2>nul
mkdir workspace 2>nul
echo ✓ Directories created
echo.

echo -^> Creating virtual environment...
python -m venv venv
echo ✓ Virtual environment created
echo.

echo -^> Installing Python dependencies...
call venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install playwright fastapi uvicorn pydantic websockets aiohttp python-dotenv

echo -^> Installing Playwright browsers (this may take a few minutes)...
playwright install chromium
echo ✓ Dependencies installed
echo.

echo -^> Setting up implementation files...
type nul > browser_automation\__init__.py
type nul > mcp_server\__init__.py
echo ✓ Project structure ready
echo.

echo ==========================================
echo Setup Complete!
echo ==========================================
echo.
echo Next steps:
echo 1. Copy your implementation files to:
echo    - browser_automation\claude_client.py
echo    - browser_automation\session_manager.py
echo    - mcp_server\server.py
echo.
echo 2. Start the server:
echo    cd ai-ide-bridge
echo    call venv\Scripts\activate.bat
echo    python mcp_server\server.py
echo.
echo 3. Install VS Code extension:
echo    Open VS Code extension project
echo    npm install ^&^& npm run compile
echo    Press F5 to launch Extension Development Host
echo.
echo ==========================================
pause
