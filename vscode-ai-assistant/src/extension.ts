import * as vscode from 'vscode';
import { MCPClient } from './mcpClient';
import { registerCommands } from './commands';
import { DiagnosticManager } from './diagnostics';
import { StatusBarManager } from './ui/statusBar';
import { ChatViewProvider } from './ui/chatProvider';

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
    
    // Register Sidebar Chat Webview
    const chatProvider = new ChatViewProvider(context, mcpClient);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(ChatViewProvider.viewType, chatProvider, {
            webviewOptions: { retainContextWhenHidden: true }
        })
    );
    
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
                // The extension runs from the 'out' folder: vscode-ai-assistant/out
                // So going up twice gives us the root 'files' folder, where 'ai-ide-bridge' is located.
                // We use __dirname to get the absolute path correctly regarless of the open workspace.
                const path = require('path');
                const serverPath = path.resolve(__dirname, '..', '..', 'ai-ide-bridge');
                terminal.sendText(`cd "${serverPath}" && .\\venv\\Scripts\\activate && python mcp_server\\server.py`);
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
