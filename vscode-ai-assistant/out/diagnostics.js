"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiagnosticManager = void 0;
const vscode = require("vscode");
class DiagnosticManager {
    constructor(mcpClient) {
        this.mcpClient = mcpClient;
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('ai-assistant');
    }
    async analyzeDocument(document) {
        if (document.uri.scheme !== 'file') {
            return;
        }
        try {
            const result = await this.mcpClient.execute({
                tool: 'get_diagnostics',
                parameters: { path: document.uri.fsPath }
            });
            if (result.success && result.data && result.data.diagnostics) {
                const diagnostics = result.data.diagnostics.map((diag) => {
                    const range = new vscode.Range(diag.line || 0, diag.column || 0, diag.line || 0, diag.endColumn || 100);
                    const severity = diag.severity === 'error'
                        ? vscode.DiagnosticSeverity.Error
                        : diag.severity === 'warning'
                            ? vscode.DiagnosticSeverity.Warning
                            : vscode.DiagnosticSeverity.Information;
                    return new vscode.Diagnostic(range, diag.message, severity);
                });
                this.diagnosticCollection.set(document.uri, diagnostics);
            }
        }
        catch (error) {
            console.error('Failed to get diagnostics:', error);
        }
    }
    clearDiagnostics(uri) {
        this.diagnosticCollection.delete(uri);
    }
    dispose() {
        this.diagnosticCollection.dispose();
    }
}
exports.DiagnosticManager = DiagnosticManager;
//# sourceMappingURL=diagnostics.js.map