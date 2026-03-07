import * as vscode from 'vscode';

export class StatusBarManager implements vscode.Disposable {
    private statusBarItem: vscode.StatusBarItem;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this.statusBarItem.command = 'ai-assistant.askQuestion';
        this.setDisconnected();
        this.statusBarItem.show();
    }

    setConnected(): void {
        this.statusBarItem.text = '$(check) AI Assistant';
        this.statusBarItem.tooltip = 'AI Assistant connected - Click to ask a question';
        this.statusBarItem.backgroundColor = undefined;
    }

    setDisconnected(): void {
        this.statusBarItem.text = '$(x) AI Assistant';
        this.statusBarItem.tooltip = 'AI Assistant disconnected - Server not running';
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    }

    setWorking(): void {
        this.statusBarItem.text = '$(sync~spin) AI Assistant';
        this.statusBarItem.tooltip = 'AI Assistant is processing...';
    }

    dispose(): void {
        this.statusBarItem.dispose();
    }
}
