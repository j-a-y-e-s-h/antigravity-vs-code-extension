"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCommands = registerCommands;
const vscode = require("vscode");
function registerCommands(context, mcpClient, diagnosticManager) {
    // Analyze current file
    context.subscriptions.push(vscode.commands.registerCommand('ai-assistant.analyzeFile', async () => {
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
                const panel = vscode.window.createWebviewPanel('aiAnalysis', 'Code Analysis Results', vscode.ViewColumn.Beside, {});
                panel.webview.html = formatAnalysisResults(result);
            }
            catch (error) {
                vscode.window.showErrorMessage(`Analysis failed: ${error.message}`);
            }
        });
    }));
    // Ask AI a question
    context.subscriptions.push(vscode.commands.registerCommand('ai-assistant.askQuestion', async () => {
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
                const context = {};
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
            }
            catch (error) {
                vscode.window.showErrorMessage(`AI query failed: ${error.message}`);
            }
        });
    }));
    // Explain selected code
    context.subscriptions.push(vscode.commands.registerCommand('ai-assistant.explainCode', async () => {
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
                const action = await vscode.window.showInformationMessage('Explanation ready!', 'View Details');
                if (action === 'View Details') {
                    const outputChannel = vscode.window.createOutputChannel('AI Explanation');
                    outputChannel.clear();
                    outputChannel.appendLine('CODE EXPLANATION');
                    outputChannel.appendLine('='.repeat(60));
                    outputChannel.appendLine(response);
                    outputChannel.show();
                }
            }
            catch (error) {
                vscode.window.showErrorMessage(`Explanation failed: ${error.message}`);
            }
        });
    }));
    // Refactor code
    context.subscriptions.push(vscode.commands.registerCommand('ai-assistant.refactorCode', async () => {
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
                await vscode.commands.executeCommand('vscode.diff', originalDoc.uri, refactoredDoc.uri, 'Original ↔ Refactored');
            }
            catch (error) {
                vscode.window.showErrorMessage(`Refactoring failed: ${error.message}`);
            }
        });
    }));
    // Fix error
    context.subscriptions.push(vscode.commands.registerCommand('ai-assistant.fixError', async () => {
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
                const panel = vscode.window.createWebviewPanel('aiFix', 'Fix Suggestions', vscode.ViewColumn.Beside, {});
                panel.webview.html = formatFixSuggestions(result);
            }
            catch (error) {
                vscode.window.showErrorMessage(`Fix suggestion failed: ${error.message}`);
            }
        });
    }));
    // Deep Workspace Agent Task
    context.subscriptions.push(vscode.commands.registerCommand('ai-assistant.deepWorkspaceTask', async () => {
        const objective = await vscode.window.showInputBox({
            prompt: 'What would you like the AI agent to implement or analyze?',
            placeHolder: 'e.g., Debug why my login flow fails and fix it locally.'
        });
        if (!objective) {
            return;
        }
        vscode.window.showInformationMessage('Deep workspace task started. This may take several minutes as the AI explores your codebase...');
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'AI Agent is working autonomously...',
            cancellable: false
        }, async (progress) => {
            try {
                const editor = vscode.window.activeTextEditor;
                const context = {};
                if (editor) {
                    context.current_file = editor.document.uri.fsPath;
                }
                const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '.';
                context.workspace_root = workspacePath;
                const result = await mcpClient.runAgentTask(objective, context);
                // Show response in output channel
                const outputChannel = vscode.window.createOutputChannel('AI Deep Agent Task');
                outputChannel.clear();
                outputChannel.appendLine('='.repeat(60));
                outputChannel.appendLine(`Objective: ${objective}`);
                outputChannel.appendLine('='.repeat(60));
                outputChannel.appendLine(result.summary);
                // Handle IDE Frontend Actions
                if (result.actions && result.actions.length > 0) {
                    for (const action of result.actions) {
                        if (action.type === 'open_file' && action.path) {
                            try {
                                const uri = vscode.Uri.file(action.path);
                                const doc = await vscode.workspace.openTextDocument(uri);
                                await vscode.window.showTextDocument(doc, { preview: false });
                            }
                            catch (err) {
                                console.error(`Failed to open file: ${action.path}`, err);
                            }
                        }
                    }
                }
                outputChannel.appendLine('='.repeat(60));
                outputChannel.show();
                vscode.window.showInformationMessage('Agentic task completed successfully!');
            }
            catch (error) {
                vscode.window.showErrorMessage(`Deep workspace task failed: ${error.message}`);
            }
        });
    }));
}
function formatAnalysisResults(result) {
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
function formatFixSuggestions(result) {
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
function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
//# sourceMappingURL=commands.js.map