import * as vscode from 'vscode';

export class StatusBarManager implements vscode.Disposable {
    private item: vscode.StatusBarItem;

    constructor() {
        this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.item.command = 'ai-assistant.askQuestion';
        this.setDisconnected();
        this.item.show();
    }

    setConnected(model?: string): void {
        this.item.text = '$(check) AI' + (model ? ' (' + model + ')' : '');
        this.item.tooltip = 'AI Assistant connected â€” click to ask a question';
        this.item.backgroundColor = undefined;
        this.item.color = undefined;
    }

    setDisconnected(): void {
        this.item.text = '$(x) AI Offline';
        this.item.tooltip = 'AI Assistant: server not running';
        this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    }

    setWorking(): void {
        this.item.text = '$(sync~spin) AI Working...';
        this.item.tooltip = 'AI Assistant is processing...';
        this.item.backgroundColor = undefined;
    }

    dispose(): void { this.item.dispose(); }
}