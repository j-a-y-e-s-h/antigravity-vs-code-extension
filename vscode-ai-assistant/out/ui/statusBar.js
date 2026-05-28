"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatusBarManager = void 0;
const vscode = require("vscode");
class StatusBarManager {
    constructor() {
        this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.item.command = 'ai-assistant.askQuestion';
        this.setDisconnected();
        this.item.show();
    }
    setConnected(model) {
        this.item.text = '$(check) AI' + (model ? ' (' + model + ')' : '');
        this.item.tooltip = 'AI Assistant connected â€” click to ask a question';
        this.item.backgroundColor = undefined;
        this.item.color = undefined;
    }
    setDisconnected() {
        this.item.text = '$(x) AI Offline';
        this.item.tooltip = 'AI Assistant: server not running';
        this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    }
    setWorking() {
        this.item.text = '$(sync~spin) AI Working...';
        this.item.tooltip = 'AI Assistant is processing...';
        this.item.backgroundColor = undefined;
    }
    dispose() { this.item.dispose(); }
}
exports.StatusBarManager = StatusBarManager;
//# sourceMappingURL=statusBar.js.map