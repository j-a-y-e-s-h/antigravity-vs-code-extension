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
let statusBar;
let healthTimer;
async function activate(context) {
    console.log('AI IDE Assistant activating...');
    const mcpClient = new mcpClient_1.MCPClient();
    const diagnosticManager = new diagnostics_1.DiagnosticManager(mcpClient);
    context.subscriptions.push(diagnosticManager);
    statusBar = new statusBar_1.StatusBarManager();
    context.subscriptions.push(statusBar);
    const chatProvider = new chatProvider_1.ChatViewProvider(context, mcpClient);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(chatProvider_1.ChatViewProvider.viewType, chatProvider, {
        webviewOptions: { retainContextWhenHidden: true }
    }));
    (0, commands_1.registerCommands)(context, mcpClient, diagnosticManager);
    // Auto-analyze on save
    const config = vscode.workspace.getConfiguration('ai-assistant');
    if (config.get('autoAnalyze')) {
        context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(doc => diagnosticManager.analyzeDocument(doc)));
    }
    // Poll server health every 10 s so status bar stays accurate
    async function pollHealth() {
        const ok = await mcpClient.checkHealth();
        if (ok) {
            statusBar.setConnected();
            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                const wp = vscode.workspace.workspaceFolders[0].uri.fsPath;
                const cfg = vscode.workspace.getConfiguration('ai-assistant');
                try {
                    await mcpClient.setWorkspace(wp, cfg.get('projectType'));
                }
                catch (_) { /* ignore */ }
            }
        }
        else {
            statusBar.setDisconnected();
        }
    }
    await pollHealth();
    healthTimer = setInterval(pollHealth, 10000);
    context.subscriptions.push({
        dispose: () => { if (healthTimer !== undefined) {
            clearInterval(healthTimer);
        } }
    });
    console.log('AI IDE Assistant active.');
}
function deactivate() {
    if (healthTimer !== undefined) {
        clearInterval(healthTimer);
    }
}
//# sourceMappingURL=extension.js.map