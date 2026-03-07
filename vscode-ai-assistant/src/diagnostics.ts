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
