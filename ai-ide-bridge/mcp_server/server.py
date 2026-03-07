from contextlib import asynccontextmanager
import ast
import re
import json
import subprocess
import os
import asyncio
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, WebSocket, HTTPException, BackgroundTasks
import sys
from pathlib import Path

# Add the root 'ai-ide-bridge' directory to sys.path
root_dir = Path(__file__).resolve().parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

# fmt: off
# isort: skip
from browser_automation.claude_client import ClaudeWebClient
from browser_automation.session_manager import SessionManager
# fmt: on


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle events for the AI-IDE Bridge Server."""
    global ai_client, session_manager

    # --- STARTUP ---
    print("=" * 60)
    print("AI-IDE Bridge Server Starting...")
    print("=" * 60)

    session_manager = SessionManager()
    ai_client = ClaudeWebClient()

    # Initialize browser
    print("→ Initializing browser automation...")
    await ai_client.initialize(headless=False)  # Set False for debugging

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
        # Start background refresh
        asyncio.create_task(session_refresh_loop())

    print("=" * 60)

    yield

    # --- SHUTDOWN ---
    print("\n→ Shutting down server...")
    if ai_client:
        await ai_client.close()
    print("✓ Cleanup complete")

app = FastAPI(
    title="AI-IDE Bridge Server",
    description="MCP server bridging IDE with AI assistants",
    version="1.0.0",
    lifespan=lifespan
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
    excluded_dirs: List[str] = Field(default_factory=lambda: [
                                     'node_modules', '__pycache__', '.git', 'venv', 'env'])


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
        print(f"\\n→ Executing tool: {request.tool}")

        # Route to appropriate handler
        handlers = {
            "view_file": handle_view_file,
            "view_file_outline": handle_view_file_outline,
            "write_to_file": handle_write_to_file,
            "list_dir": handle_list_dir,
            "grep_search": handle_grep_search,
            "replace_file_content": handle_replace_file_content,
            "execute_command": handle_execute_command,
            "analyze_code": handle_analyze_code,
            "suggest_fix": handle_suggest_fix,
            "ai_query": handle_ai_query,
            "get_diagnostics": handle_get_diagnostics,
            "agent_task": handle_agent_task,
            "new_chat": handle_new_chat,
            "list_chats": handle_list_chats,
            "switch_chat": handle_switch_chat,
            "stop": handle_stop_generation,
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


async def handle_view_file_outline(params: Dict, context: Optional[Dict] = None) -> Dict:
    """View structurally important elements of a file."""
    file_path = get_absolute_path(params.get('AbsolutePath', ''))

    if not is_path_safe(file_path) or not file_path.exists():
        return {"error": f"Invalid or missing file: {file_path}"}

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        lines = content.splitlines()
        total_lines = len(lines)
        outline = []

        if file_path.suffix == '.py':
            tree = ast.parse(content)
            for node in ast.walk(tree):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                    name = node.name
                    start = node.lineno
                    end = node.end_lineno if hasattr(
                        node, 'end_lineno') else start
                    outline.append({'name': name, 'type': type(
                        node).__name__, 'start': start, 'end': end})
        else:
            # Fallback regex for JS/TS
            import re
            pattern = re.compile(
                r'^(?:export\s+)?(?:default\s+)?(?:class|function)\s+([a-zA-Z0-9_]+)')
            for i, line in enumerate(lines, 1):
                m = pattern.search(line)
                if m:
                    outline.append(
                        {'name': m.group(1), 'signature': line.strip(), 'start': i, 'end': i})

        return {
            "file": str(file_path),
            "total_lines": total_lines,
            "outline": outline
        }
    except Exception as e:
        return {"error": str(e)}


async def handle_view_file(params: Dict, context: Optional[Dict] = None) -> Dict:
    """View file with line numbers for exact replacements."""
    file_path = get_absolute_path(params.get('AbsolutePath', ''))
    start_line = params.get('StartLine', 1)
    end_line = params.get('EndLine', None)

    if not is_path_safe(file_path) or not file_path.exists():
        return {"error": f"Invalid or missing file path: {file_path}"}

    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()

    total_lines = len(lines)
    if end_line is None or end_line > total_lines:
        end_line = total_lines

    if start_line < 1:
        start_line = 1

    slice_lines = lines[start_line - 1:end_line]
    numbered_content = "".join(
        [f"{i+start_line}: {line}" for i, line in enumerate(slice_lines)])

    return {
        "path": str(file_path),
        "content": numbered_content,
        "total_lines": total_lines,
        "start_line": start_line,
        "end_line": end_line
    }


async def handle_list_dir(params: Dict, context: Optional[Dict] = None) -> Dict:
    """List files in directory."""
    raw_dir = params.get('DirectoryPath')
    directory = get_absolute_path(raw_dir) if raw_dir else (
        workspace_root or Path('.'))

    if not is_path_safe(directory) or not directory.exists():
        return {"error": f"Invalid directory: {directory}"}

    files = []
    try:
        import os
        for item in directory.iterdir():
            files.append({
                "name": item.name,
                "type": "directory" if item.is_dir() else "file",
                "path": str(item.relative_to(workspace_root) if workspace_root else item)
            })
    except Exception as e:
        return {"error": str(e)}

    return {
        "directory": str(directory),
        "contents": files
    }


async def handle_grep_search(params: Dict, context: Optional[Dict] = None) -> Dict:
    """Search for string in workspace using ripgrep or python fallback."""
    search_path = get_absolute_path(params.get('SearchPath', '.'))
    query = params.get('Query', '')

    if not query:
        return {"error": "Query parameter is missing."}

    if not workspace_root:
        return {"error": "Searching is not possible because no workspace is open. Please use the 'set_workspace' tool or open a folder in VS Code first."}

    if not is_path_safe(search_path):
        return {"error": "Invalid search path: must be within the workspace root."}

    import subprocess
    try:
        # fallback to ripgrep if available, else standard
        # Use str() to ensure it's a path string
        result = subprocess.run(
            ['rg', '--line-number', '--column',
                '--smart-case', query, str(search_path)],
            capture_output=True,
            text=True,
            timeout=20
        )
        output = result.stdout if result.returncode == 0 else result.stderr
        # Limit output size
        return {"results": output[:50000], "success": result.returncode == 0}
    except FileNotFoundError:
        # ripgrep not available, perform basic python search
        results = []
        try:
            for root, dirs, files in os.walk(search_path):
                # skip hidden/venv
                dirs[:] = [d for d in dirs if not d.startswith('.') and d not in (
                    'node_modules', 'venv', 'env', '__pycache__')]
                for f in files:
                    if f.endswith(('.py', '.js', '.ts', '.jsx', '.tsx', '.md', '.txt')):
                        filepath = Path(root) / f
                        try:
                            with open(filepath, 'r', encoding='utf-8') as f_in:
                                for i, line in enumerate(f_in, 1):
                                    if query in line:
                                        results.append(
                                            f"{filepath}:{i}:{line.strip()}")
                                        if len(results) > 100:
                                            break
                        except:
                            pass
                if len(results) > 100:
                    break
            return {"results": "\n".join(results), "success": True}
        except Exception as e:
            return {"error": str(e)}


async def handle_replace_file_content(params: Dict, context: Optional[Dict] = None) -> Dict:
    """Surgical exact-string replacement within StartLine and EndLine bounds."""
    file_path = get_absolute_path(params.get('TargetFile', ''))
    target = params.get('TargetContent', '')
    replacement = params.get('ReplacementContent', '')
    start_line = params.get('StartLine', 1)
    end_line = params.get('EndLine', None)

    if not is_path_safe(file_path) or not file_path.exists():
        return {"error": f"File not found: {file_path}"}

    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    total_lines = len(lines)
    if end_line is None or end_line > total_lines:
        end_line = total_lines

    if start_line < 1:
        start_line = 1

    slice_to_search = "".join(lines[start_line - 1:end_line])

    if target not in slice_to_search:
        return {"error": "TargetContent string not found exactly within bounds. Ensure whitespace, indentation, and newlines match perfectly."}

    new_slice = slice_to_search.replace(target, replacement)

    lines[start_line - 1:end_line] = [new_slice]
    new_content = "".join(lines)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)

    return {
        "success": f"Replaced target text perfectly in {file_path}",
    }


async def handle_write_to_file(params: Dict, context: Optional[Dict] = None) -> Dict:
    """Create or violently overwrite a file."""
    file_path = get_absolute_path(params.get('TargetFile', ''))
    content = params.get('CodeContent', '')
    overwrite = params.get('Overwrite', False)

    if not is_path_safe(file_path):
        return {"error": f"Invalid file path: {file_path}"}

    if file_path.exists() and not overwrite:
        return {"error": f"File already exists: {file_path}. Set Overwrite=True to overwrite."}

    file_path.parent.mkdir(parents=True, exist_ok=True)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

    return {
        "success": f"Created/Overwritten {file_path}",
    }


# ==================== Command Execution ====================

async def handle_execute_command(params: Dict, context: Optional[Dict] = None) -> Dict:
    """Execute terminal command."""
    command = params['command']
    cwd = params.get('cwd', str(workspace_root or Path.cwd()))
    timeout = params.get('timeout', 30)
    shell = params.get('shell', True)

    # Prevent hallucinated paths and enforce workspace context
    if cwd == "." or not cwd or "home/claude" in cwd.replace('\\', '/') or cwd.startswith('~/'):
        if workspace_root:
            cwd = str(workspace_root)
        else:
            cwd = "."
    elif cwd != "." and workspace_root:
        cwd = str(get_absolute_path(cwd))

    # Security check
    if not is_command_safe(command):
        raise ValueError(f"Command not allowed: {command}")

    print(f"  Executing: {command}")

    try:
        # Windows "start" commands spawn new windows that keep stdout pipes open,
        # causing subprocess.run to hang indefinitely if we try to capture output.
        if command.strip().lower().startswith("start "):
            subprocess.Popen(command, shell=shell, cwd=cwd)
            return {
                "command": command,
                "stdout": "Command started in background process.",
                "stderr": "",
                "returncode": 0,
                "success": True
            }

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
    prompt = build_analysis_prompt(
        code_content, file_path, analysis_type, context)

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


# ==================== Agent Task Loop ====================

agent_system_prompt_sent = False


def extract_json_object(text: str) -> Optional[str]:
    """Find the first valid JSON object in a string by brace matching."""
    start_idx = text.find('{')
    if start_idx == -1:
        return None

    brace_count = 0
    in_string = False
    escape_next = False

    for i in range(start_idx, len(text)):
        char = text[i]

        if escape_next:
            escape_next = False
            continue

        if char == '\\':
            escape_next = True
            continue

        if char == '"':
            in_string = not in_string
            continue

        if not in_string:
            if char == '{':
                brace_count += 1
            elif char == '}':
                brace_count -= 1

            if brace_count == 0:
                return text[start_idx:i+1]

    return None


async def handle_new_chat(params: Dict, context: Optional[Dict] = None) -> Dict:
    """Clear local chat history and trigger new chat in Claude."""
    global agent_system_prompt_sent
    agent_system_prompt_sent = False
    await ai_client.clear_chat()
    # Go to new chat immediately
    if not ai_client.page.url.endswith('/new'):
        await ai_client.page.goto('https://claude.ai/new')
    return {"success": "New chat started successfully."}


async def handle_list_chats(params: Dict, context: Optional[Dict] = None) -> Dict:
    """Fetch recent chats list from browser."""
    limit = params.get('limit', 20)
    chats = await ai_client.get_recent_chats(limit)
    return {"success": True, "chats": chats}


async def handle_switch_chat(params: Dict, context: Optional[Dict] = None) -> Dict:
    """Switch browser to a specific past chat and fetch its history."""
    chat_id = params.get('chat_id')
    if not chat_id:
        return {"error": "chat_id is required"}
    await ai_client.switch_chat(chat_id)
    history = await ai_client.get_conversation_history(chat_id)
    return {"success": True, "history": history}


async def handle_stop_generation(params: Dict, context: Optional[Dict] = None) -> Dict:
    """Stop the current generation."""
    success = await ai_client.stop_generation()
    return {"success": success}


async def handle_agent_task(params: Dict, context: Optional[Dict] = None) -> Dict:
    """Execute a deep workspace task via an agentic loop."""
    global agent_system_prompt_sent
    objective = params.get('objective')

    # Initialize the prompt with a brief tool reminder only once per session
    if not agent_system_prompt_sent:
        # Load language templates based on context or workspace
        lang_prompts = []
        prompts_dir = Path(__file__).resolve().parent / "prompts"

        target_langs = []
        if context and context.get('project_type'):
            target_langs.append(context['project_type'].lower())

        # Heuristic: check workspace for file extensions if lang not explicitly set
        if not target_langs and workspace_root:
            possible_langs = {'py': 'python', 'dart': 'dart',
                              'ts': 'typescript', 'js': 'typescript'}
            for ext, lang in possible_langs.items():
                if any(workspace_root.glob(f"**/*.{ext}")):
                    if lang not in target_langs:
                        target_langs.append(lang)

        for lang in target_langs:
            prompt_file = prompts_dir / f"{lang}.md"
            if prompt_file.exists():
                with open(prompt_file, 'r', encoding='utf-8') as f:
                    lang_prompts.append(f.read())

        lang_context = "\n\n".join(lang_prompts) if lang_prompts else ""

        message_to_send = f"""[System Environment: You are an autonomous AI IDE Assistant connected to VS Code.
You can use tools to navigate and modify the user's workspace.
CURRENT WORKSPACE ROOT: `{workspace_root if workspace_root else "NOT SET (Please ask the user to open a folder in VS Code)"}`

To use a tool, you MUST output a JSON block like this:
```json
{{"name": "view_file", "params": {{"AbsolutePath": "..."}}}}
```
Available tools: 
- view_file_outline(AbsolutePath): Returns AST structure (classes/functions) of a file with line numbers. Use this FIRST to grok large files without overflowing context.
- view_file(AbsolutePath, StartLine, EndLine): Returns contents of a file with line numbers prepended.
- write_to_file(TargetFile, CodeContent, Overwrite): Creates or violently overwrites a file local to the workspace.
- replace_file_content(TargetFile, TargetContent, ReplacementContent, StartLine, EndLine): Surgical exact-string replacement within StartLine and EndLine bounds. TargetContent MUST perfectly match the existing code character-by-character, including whitespace/indentation.
- list_dir(DirectoryPath): Lists files in a directory.
- grep_search(SearchPath, Query): Searches for exact query strings across files.
- execute_command(command, cwd): Runs a terminal command
- create_folder(path): Creates a new folder
- open_file_in_ide(path): Opens a file natively in the user's VS Code window so they can see it

{lang_context}

CRITICAL BEHAVIOR RULES:
1. ALWAYS use absolute paths.
2. If the workspace root is NOT SET, tell the user to open a folder in VS Code before you can perform file-based actions.
3. If editing an existing file, try to use replace_file_content instead of write_to_file to avoid replacing the whole file context unless necessary.
4. Windows paths often contain spaces. DO NOT truncate it at the space. Extract the full intended path name exactly.

I (the system) will execute the tool and reply with a ```tool_result``` block. 
You can only use ONE tool per response. 
Once you have fulfilled the user's request, output your final response to the user and DO NOT output any tool calls.]

User message / Objective: {objective}
"""
        agent_system_prompt_sent = True
    else:
        message_to_send = f"User message: {objective}\n[Reminder: You can use tools by outputting JSON. Output final response when done.]"

    max_steps = 15
    steps_taken = 0
    final_output = ""
    frontend_actions = []

    print(f"\\n[AGENT] Starting autonomous task: {objective}")

    while steps_taken < max_steps:
        steps_taken += 1
        print(f"[AGENT] Step {steps_taken}/{max_steps}...")

        # We type the message into the browser window exactly as it is
        response = await ai_client.send_message(message_to_send)

        # Debug: Print the first 200 chars to terminal
        preview = response[:200].replace('\n', ' ') + "..."
        print(f"  [AGENT] Received: {preview}")

        # Try to parse tool call
        tool_data = None

        # 1. Look for marked JSON blocks first
        tool_call_match = re.search(
            r'```(?:json|tool_call)?\s*\n\s*({.*?"name"\s*:.*?"params"\s*:.*?})\s*\n```', response, re.DOTALL)
        if tool_call_match:
            try:
                tool_data = json.loads(tool_call_match.group(1))
            except:
                pass

        # 2. Extract bare JSON via brace matching if marked block fails
        if not tool_data:
            extracted_json = extract_json_object(response)
            if extracted_json:
                try:
                    parsed = json.loads(extracted_json)
                    if isinstance(parsed, dict) and 'name' in parsed and 'params' in parsed:
                        tool_data = parsed
                except:
                    pass

        if tool_data:
            try:
                tool_name = tool_data.get('name')
                tool_params = tool_data.get('params', {})

                print(f"  [AGENT] Tool Call: {tool_name}")

                # Setup internal routing
                if tool_name == "view_file":
                    result = await handle_view_file(tool_params, context)
                elif tool_name == "view_file_outline":
                    result = await handle_view_file_outline(tool_params, context)
                elif tool_name == "list_dir":
                    result = await handle_list_dir(tool_params, context)
                elif tool_name == "grep_search":
                    result = await handle_grep_search(tool_params, context)
                elif tool_name == "replace_file_content":
                    result = await handle_replace_file_content(tool_params, context)
                elif tool_name == "write_to_file":
                    result = await handle_write_to_file(tool_params, context)
                elif tool_name == "execute_command":
                    result = await handle_execute_command(tool_params, context)
                elif tool_name == "create_folder":
                    folder_path = get_absolute_path(
                        tool_params.get('path', ''))
                    if folder_path:
                        folder_path.mkdir(parents=True, exist_ok=True)
                        result = {
                            "success": f"Folder created at {folder_path}"}
                    else:
                        result = {"error": "Path parameter is missing"}
                elif tool_name == "open_file_in_ide":
                    path_to_open = get_absolute_path(
                        tool_params.get('path', ''))
                    if path_to_open:
                        frontend_actions.append(
                            {"type": "open_file", "path": str(path_to_open)})
                        result = {
                            "success": f"File {path_to_open} queued to be opened in IDE"}
                    else:
                        result = {"error": "Path parameter is missing"}
                else:
                    result = {"error": f"Unknown tool: {tool_name}"}

                # Set the NEXT message to send to just be the tool result! Do not include Claude's own response.
                result_str = json.dumps(result, indent=2)
                message_to_send = f"```tool_result\n{result_str}\n```\nContinue with the objective. Use tools if necessary."

            except Exception as e:
                error_str = f"Tool parsing/execution failed: {str(e)}"
                print(f"  [AGENT] Error: {error_str}")
                error_json = json.dumps({"error": error_str}, indent=2)
                message_to_send = f"```tool_result\n{error_json}\n```\nContinue."

        else:
            # No tool call.
            # If it's the very first step and Claude is just introduced, don't quit.
            if steps_taken == 1:
                print("  [AGENT] No tool call in Step 1. Prompting for action...")
                message_to_send = f"Please proceed with using tools to fulfill my objective: {objective}\nIf you don't need tools, just say so explicitly."
                continue

            # Otherwise, task is done
            print(f"[AGENT] Task completed.")
            final_output = response
            break

    if steps_taken >= max_steps:
        final_output = response + "\n\n[Task paused due to max steps reached.]"

    return {
        "objective": objective,
        "steps_taken": steps_taken,
        "final_summary": final_output,
        "frontend_actions": frontend_actions
    }


# ==================== Helper Functions ====================

def build_analysis_prompt(code: str, file_path: str, analysis_type: str, context: Optional[Dict]) -> str:
    """Build prompt for code analysis."""

    # Base context
    project_info = ""
    if context and 'project_type' in context:
        project_info = f"Project type: {context['project_type']}\\n"

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
    parts = [query, "\\n--- Context ---"]

    if 'current_file' in context:
        parts.append(f"Current file: {context['current_file']}")

    if 'selection' in context:
        parts.append(f"Selected code:\\n```\\n{context['selection']}\\n```")

    if 'project_type' in context:
        parts.append(f"Project: {context['project_type']}")

    if 'recent_errors' in context:
        parts.append(f"Recent errors:\\n{context['recent_errors']}")

    if 'open_files' in context:
        parts.append(f"Open files: {', '.join(context['open_files'])}")

    return "\\n".join(parts)


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


def get_absolute_path(path_str: str) -> Path:
    """Resolve a path against the VS Code workspace root."""
    path = Path(path_str)
    if workspace_root and not path.is_absolute():
        return workspace_root / path
    return path


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
        raise HTTPException(
            status_code=400, detail="Workspace path does not exist")

    if not path.is_dir():
        raise HTTPException(
            status_code=400, detail="Workspace path must be a directory")

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

            elif data['type'] == 'stop':
                await ai_client.stop_generation()
                await websocket.send_json({'type': 'stopped'})

            elif data['type'] == 'query':
                # Handle real-time query with streaming
                message = data['message']
                chat_id = data.get('chat_id')

                async def stream_callback(token: str):
                    try:
                        await websocket.send_json({
                            'type': 'chunk',
                            'text': token
                        })
                    except:
                        pass  # Connection may have closed

                response = await ai_client.send_message(message, chat_id=chat_id, stream_callback=stream_callback)
                await websocket.send_json({
                    'type': 'response',
                    'content': response
                })

    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        active_connections.remove(websocket)


# ==================== Background Logic ====================

async def session_refresh_loop():
    """Periodically refresh the session to keep it alive."""
    while True:
        await asyncio.sleep(900)  # 15 minutes
        if ai_client and ai_client.page:
            try:
                print("→ Refreshing session...")
                await ai_client.page.evaluate("window.scrollTo(0, 1); window.scrollTo(0, 0);")
            except Exception as e:
                print(f"✗ Session refresh failed: {e}")


# ==================== Dashboard ====================

@app.get("/")
async def get_dashboard():
    """Serve the status dashboard."""
    from fastapi.responses import HTMLResponse
    html_content = """
    <!DOCTYPE html>
    <html>
        <head>
            <title>AI-IDE Bridge Dashboard</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #0f172a; color: #f8fafc; padding: 2rem; }
                .card { background: #1e293b; border-radius: 0.5rem; padding: 1.5rem; margin-bottom: 1rem; border: 1px solid #334155; }
                h1 { color: #38bdf8; margin-top: 0; }
                .status-on { color: #22c55e; }
                .status-off { color: #ef4444; }
                pre { background: #000; padding: 1rem; border-radius: 0.25rem; overflow-x: auto; font-size: 0.875rem; color: #10b981; }
            </style>
        </head>
        <body>
            <h1>AI-IDE Bridge Status</h1>
            <div class="card">
                <h2>Server Information</h2>
                <div id="status-info">Loading...</div>
            </div>
            <div class="card">
                <h2>Active Connections</h2>
                <div id="connections-info">Loading...</div>
            </div>
            <script>
                async function updateStatus() {
                    const res = await fetch('/status');
                    const data = await res.json();
                    document.getElementById('status-info').innerHTML = `
                        <p>Status: <span class="${data.ai_client.authenticated ? 'status-on' : 'status-off'}">${data.ai_client.authenticated ? 'Connected' : 'Disconnected'}</span></p>
                        <p>Chat ID: <code>${data.ai_client.chat_id || 'None'}</code></p>
                        <p>Workspace: <code>${data.workspace || 'Not Set'}</code></p>
                    `;
                    document.getElementById('connections-info').innerHTML = `
                        <p>WebSocket Connections: ${data.active_connections}</p>
                    `;
                }
                setInterval(updateStatus, 5000);
                updateStatus();
            </script>
        </body>
    </html>
    """
    return HTMLResponse(content=html_content, status_code=200)


# ==================== Main ====================

if __name__ == "__main__":
    import uvicorn

    print("\\n" + "=" * 60)
    print("AI-IDE Bridge Server")
    print("=" * 60)
    print("\\nStarting server on http://localhost:8000")
    print("API docs available at http://localhost:8000/docs")
    print("\\n" + "=" * 60 + "\\n")

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
