"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatusBarManager = void 0;
const vscode = require("vscode");
class StatusBarManager {
    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = 'ai-assistant.askQuestion';
        this.setDisconnected();
        this.statusBarItem.show();
    }
    setConnected() {
        this.statusBarItem.text = '$(check) AI Assistant';
        this.statusBarItem.tooltip = 'AI Assistant connected - Click to ask a question';
        this.statusBarItem.backgroundColor = undefined;
    }
    setDisconnected() {
        this.statusBarItem.text = '$(x) AI Assistant';
        this.statusBarItem.tooltip = 'AI Assistant disconnected - Server not running';
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    }
    setWorking() {
        this.statusBarItem.text = '$(sync~spin) AI Assistant';
        this.statusBarItem.tooltip = 'AI Assistant is processing...';
    }
    dispose() {
        this.statusBarItem.dispose();
    }
}
exports.StatusBarManager = StatusBarManager;
//# sourceMappingURL=statusBar.js.map