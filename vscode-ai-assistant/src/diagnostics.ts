import * as vscode from 'vscode';
import { MCPClient } from './mcpClient';

export interface DiagnosticSummary {
    errors: number;
    warnings: number;
    items: { file: string; line: number; severity: string; message: string }[];
}

export class DiagnosticManager implements vscode.Disposable {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private mcpClient: MCPClient;

    constructor(mcpClient: MCPClient) {
        this.mcpClient = mcpClient;
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('ai-assistant');
    }

    async analyzeDocument(document: vscode.TextDocument): Promise<void> {
        if (document.uri.scheme !== 'file') { return; }
        try {
            const result = await this.mcpClient.execute({
                tool: 'get_diagnostics',
                parameters: { path: document.uri.fsPath }
            });
            if (result.success && result.data && result.data.diagnostics) {
                const diagnostics: vscode.Diagnostic[] = result.data.diagnostics.map((d: any) => {
                    const range = new vscode.Range(
                        d.line || 0, d.column || 0,
                        d.line || 0, d.endColumn || 100
                    );
                    const sev =
                        d.severity === 'error'   ? vscode.DiagnosticSeverity.Error :
                        d.severity === 'warning' ? vscode.DiagnosticSeverity.Warning :
                                                   vscode.DiagnosticSeverity.Information;
                    return new vscode.Diagnostic(range, d.message, sev);
                });
                this.diagnosticCollection.set(document.uri, diagnostics);
            }
        } catch (e) {
            console.error('Diagnostics error:', e);
        }
    }

    getSummary(): DiagnosticSummary {
        let errors = 0;
        let warnings = 0;
        const items: DiagnosticSummary['items'] = [];
        for (const [uri, diags] of vscode.languages.getDiagnostics()) {
            for (const d of diags) {
                const sev =
                    d.severity === vscode.DiagnosticSeverity.Error   ? 'error'   :
                    d.severity === vscode.DiagnosticSeverity.Warning ? 'warning' : 'info';
                if (sev === 'error')   { errors++;   }
                if (sev === 'warning') { warnings++; }
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

    buildFixPrompt(): string {
        const s = this.getSummary();
        if (s.errors === 0 && s.warnings === 0) {
            return 'No problems found in the workspace.';
        }
        const lines: string[] = [
            'Fix these ' + s.errors + ' error(s) and ' + s.warnings + ' warning(s):\n'
        ];
        for (const it of s.items) {
            lines.push(
                '[' + it.severity.toUpperCase() + '] ' +
                it.file + ':' + it.line + ' - ' + it.message
            );
        }
        lines.push('\nShow corrected code with explanations.');
        return lines.join('\n');
    }

    clearDiagnostics(uri: vscode.Uri): void {
        this.diagnosticCollection.delete(uri);
    }

    dispose(): void {
        this.diagnosticCollection.dispose();
    }
}