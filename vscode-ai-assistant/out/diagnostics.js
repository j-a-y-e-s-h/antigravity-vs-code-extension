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
                const diagnostics = result.data.diagnostics.map((d) => {
                    const range = new vscode.Range(d.line || 0, d.column || 0, d.line || 0, d.endColumn || 100);
                    const sev = d.severity === 'error' ? vscode.DiagnosticSeverity.Error :
                        d.severity === 'warning' ? vscode.DiagnosticSeverity.Warning :
                            vscode.DiagnosticSeverity.Information;
                    return new vscode.Diagnostic(range, d.message, sev);
                });
                this.diagnosticCollection.set(document.uri, diagnostics);
            }
        }
        catch (e) {
            console.error('Diagnostics error:', e);
        }
    }
    getSummary() {
        let errors = 0;
        let warnings = 0;
        const items = [];
        for (const [uri, diags] of vscode.languages.getDiagnostics()) {
            for (const d of diags) {
                const sev = d.severity === vscode.DiagnosticSeverity.Error ? 'error' :
                    d.severity === vscode.DiagnosticSeverity.Warning ? 'warning' : 'info';
                if (sev === 'error') {
                    errors++;
                }
                if (sev === 'warning') {
                    warnings++;
                }
                items.push({
                    file: vscode.workspace.asRelativePath(uri),
                    line: d.range.start.line + 1,
                    severity: sev,
                    message: d.message
                });
            }
        }
        return { errors, warnings, items };
    }
    buildFixPrompt() {
        const s = this.getSummary();
        if (s.errors === 0 && s.warnings === 0) {
            return 'No problems found in the workspace.';
        }
        const lines = [
            'Fix these ' + s.errors + ' error(s) and ' + s.warnings + ' warning(s):\n'
        ];
        for (const it of s.items) {
            lines.push('[' + it.severity.toUpperCase() + '] ' +
                it.file + ':' + it.line + ' - ' + it.message);
        }
        lines.push('\nShow corrected code with explanations.');
        return lines.join('\n');
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