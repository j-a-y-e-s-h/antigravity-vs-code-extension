import * as vscode from 'vscode';
import { MCPClient } from './mcpClient';
import { registerCommands } from './commands';
import { DiagnosticManager } from './diagnostics';
import { StatusBarManager } from './ui/statusBar';
import { ChatViewProvider } from './ui/chatProvider';

let statusBar: StatusBarManager;
let healthTimer: ReturnType<typeof setInterval> | undefined;

export async function activate(context: vscode.ExtensionContext) {
    console.log('AI IDE Assistant activating...');

    const mcpClient = new MCPClient();
    const diagnosticManager = new DiagnosticManager(mcpClient);
    context.subscriptions.push(diagnosticManager);

    statusBar = new StatusBarManager();
    context.subscriptions.push(statusBar);

    const chatProvider = new ChatViewProvider(context, mcpClient);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(ChatViewProvider.viewType, chatProvider, {
            webviewOptions: { retainContextWhenHidden: true }
        })
    );

    registerCommands(context, mcpClient, diagnosticManager);

    // Auto-analyze on save
    const config = vscode.workspace.getConfiguration('ai-assistant');
    if (config.get('autoAnalyze')) {
        context.subscriptions.push(
            vscode.workspace.onDidSaveTextDocument(doc => diagnosticManager.analyzeDocument(doc))
        );
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
                    await mcpClient.setWorkspace(wp, cfg.get('projectType') as string);
                } catch (_) { /* ignore */ }
            }
        } else {
            statusBar.setDisconnected();
        }
    }

    await pollHealth();
    healthTimer = setInterval(pollHealth, 10000);
    context.subscriptions.push({
        dispose: () => { if (healthTimer !== undefined) { clearInterval(healthTimer); } }
    });

    console.log('AI IDE Assistant active.');
}

export function deactivate() {
    if (healthTimer !== undefined) { clearInterval(healthTimer); }
}