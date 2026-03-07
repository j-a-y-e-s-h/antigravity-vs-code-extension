#!/bin/bash
# AI-IDE Bridge Quick Setup Script
# Run this to set up the entire system

set -e

echo "=========================================="
echo "AI-IDE Bridge - Quick Setup"
echo "=========================================="
echo ""

# Check Python version
echo "→ Checking Python version..."
python_version=$(python3 --version 2>&1 | awk '{print $2}')
echo "  Found Python $python_version"

if ! python3 -c 'import sys; exit(0 if sys.version_info >= (3, 11) else 1)'; then
    echo "✗ Python 3.11+ required"
    exit 1
fi
echo "✓ Python version OK"
echo ""

# Create project directory
echo "→ Creating project structure..."
mkdir -p ai-ide-bridge
cd ai-ide-bridge

mkdir -p browser_automation
mkdir -p mcp_server
mkdir -p sessions
mkdir -p workspace

echo "✓ Directories created"
echo ""

# Create virtual environment
echo "→ Creating virtual environment..."
python3 -m venv venv
source venv/bin/activate
echo "✓ Virtual environment created"
echo ""

# Install Python dependencies
echo "→ Installing Python dependencies..."
pip install --upgrade pip
pip install playwright fastapi uvicorn pydantic websockets aiohttp python-dotenv --break-system-packages

# Install Playwright browsers
echo "→ Installing Playwright browsers (this may take a few minutes)..."
playwright install chromium
echo "✓ Dependencies installed"
echo ""

# Download implementation files
echo "→ Setting up implementation files..."

# Create __init__.py files
touch browser_automation/__init__.py
touch mcp_server/__init__.py

echo "✓ Project structure ready"
echo ""

echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Copy your implementation files to:"
echo "   - browser_automation/claude_client.py"
echo "   - browser_automation/session_manager.py"
echo "   - mcp_server/server.py"
echo ""
echo "2. Start the server:"
echo "   cd ai-ide-bridge"
echo "   source venv/bin/activate"
echo "   python mcp_server/server.py"
echo ""
echo "3. Install VS Code extension:"
echo "   Open VS Code extension project"
echo "   npm install && npm run compile"
echo "   Press F5 to launch Extension Development Host"
echo ""
echo "=========================================="
