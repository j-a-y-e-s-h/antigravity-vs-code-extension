"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
const mcpClient_1 = require("./mcpClient");
const commands_1 = require("./commands");
const diagnostics_1 = require("./diagnostics");
const statusBar_1 = require("./ui/statusBar");
const chatProvider_1 = require("./ui/chatProvider");
let mcpClient;
let diagnosticManager;
let statusBar;
async function activate(context) {
    console.log('AI IDE Assistant is activating...');
    // Initialize MCP client
    mcpClient = new mcpClient_1.MCPClient();
    // Initialize diagnostic manager
    diagnosticManager = new diagnostics_1.DiagnosticManager(mcpClient);
    context.subscriptions.push(diagnosticManager);
    // Initialize status bar
    statusBar = new statusBar_1.StatusBarManager();
    context.subscriptions.push(statusBar);
    // Register Sidebar Chat Webview
    const chatProvider = new chatProvider_1.ChatViewProvider(context, mcpClient);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(chatProvider_1.ChatViewProvider.viewType, chatProvider, {
        webviewOptions: { retainContextWhenHidden: true }
    }));
    // Check server health
    const isHealthy = await mcpClient.checkHealth();
    if (!isHealthy) {
        vscode.window.showWarningMessage('AI IDE Assistant: Server is not running. Please start the MCP Bridge Server.', 'Open Terminal').then(selection => {
            if (selection === 'Open Terminal') {
                const terminal = vscode.window.createTerminal('AI Bridge Server');
                terminal.show();
                // The extension runs from the 'out' folder: vscode-ai-assistant/out
                // So going up twice gives us the root 'files' folder, where 'ai-ide-bridge' is located.
                // We use __dirname to get the absolute path correctly regarless of the open workspace.
                const path = require('path');
                const serverPath = path.resolve(__dirname, '..', '..', 'ai-ide-bridge');
                terminal.sendText(`cd "${serverPath}" && .\\venv\\Scripts\\activate && python mcp_server\\server.py`);
            }
        });
    }
    else {
        statusBar.setConnected();
        // Set workspace
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
            const config = vscode.workspace.getConfiguration('ai-assistant');
            const projectType = config.get('projectType');
            try {
                await mcpClient.setWorkspace(workspacePath, projectType);
                console.log('Workspace set:', workspacePath);
            }
            catch (error) {
                console.error('Failed to set workspace:', error);
            }
        }
    }
    // Register commands
    (0, commands_1.registerCommands)(context, mcpClient, diagnosticManager);
    // Watch for file saves (optional auto-analysis)
    const config = vscode.workspace.getConfiguration('ai-assistant');
    if (config.get('autoAnalyze')) {
        vscode.workspace.onDidSaveTextDocument(async (document) => {
            await diagnosticManager.analyzeDocument(document);
        });
    }
    console.log('AI IDE Assistant is now active!');
}
function deactivate() {
    console.log('AI IDE Assistant is deactivating...');
}
//# sourceMappingURL=extension.js.map