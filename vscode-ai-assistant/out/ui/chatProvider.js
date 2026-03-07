"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatViewProvider = void 0;
const vscode = require("vscode");
class ChatViewProvider {
    constructor(_context, _mcpClient) {
        this._context = _context;
        this._mcpClient = _mcpClient;
        this._messages = [];
        this._messages = this._context.workspaceState.get('chatMessages', []);
    }
    async _saveMessages() {
        await this._context.workspaceState.update('chatMessages', this._messages);
    }
    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._context.extensionUri]
        };
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'sendMessage':
                    const userMessage = data.value;
                    if (!userMessage)
                        return;
                    // Immediately echo the user's message in the UI
                    this._messages.push({ role: 'user', content: userMessage });
                    this._saveMessages();
                    this._view?.webview.postMessage({ type: 'addMessage', role: 'user', content: userMessage });
                    try {
                        // Show typing indicator
                        this._view?.webview.postMessage({ type: 'addMessage', role: 'system', content: 'thinking', id: 'thinking-indicator' });
                        // Change to runAgentTask to allow Claude to use tools and act autonomously
                        const response = await this._mcpClient.runAgentTask(userMessage);
                        // Remove thinking indicator and add real response
                        this._view?.webview.postMessage({ type: 'removeMessage', id: 'thinking-indicator' });
                        this._messages.push({ role: 'assistant', content: response.summary });
                        this._saveMessages();
                        this._view?.webview.postMessage({ type: 'addMessage', role: 'assistant', content: response.summary });
                        // Handle IDE Frontend Actions
                        if (response.actions && response.actions.length > 0) {
                            for (const action of response.actions) {
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
                    }
                    catch (error) {
                        this._view?.webview.postMessage({ type: 'removeMessage', id: 'thinking-indicator' });
                        const errorMsg = `Error: ${error.message}`;
                        this._messages.push({ role: 'error', content: errorMsg });
                        this._saveMessages();
                        this._view?.webview.postMessage({ type: 'addMessage', role: 'error', content: errorMsg });
                    }
                    break;
                case 'clearHistory':
                    this._messages = [];
                    this._saveMessages();
                    break;
                case 'newChat':
                    try {
                        vscode.window.withProgress({
                            location: vscode.ProgressLocation.Notification,
                            title: "Starting new chat...",
                        }, async () => {
                            await this._mcpClient.newChat();
                            this._messages = [];
                            this._saveMessages();
                            this._view?.webview.postMessage({ type: 'clearHistory' });
                        });
                    }
                    catch (e) {
                        vscode.window.showErrorMessage("Failed to start new chat: " + e.message);
                    }
                    break;
                case 'showHistory':
                    try {
                        const chats = await this._mcpClient.listChats(20);
                        const items = chats.map((c) => ({
                            label: c.title,
                            description: c.id
                        }));
                        const selected = await vscode.window.showQuickPick(items, { placeHolder: 'Select a past chat to open' });
                        if (selected) {
                            vscode.window.withProgress({
                                location: vscode.ProgressLocation.Notification,
                                title: "Loading chat history...",
                                cancellable: false
                            }, async () => {
                                const history = await this._mcpClient.switchChat(selected.description);
                                // Mapping history to match UI structure
                                this._messages = history.map((m) => ({
                                    role: m.role || 'assistant',
                                    content: m.content || ''
                                }));
                                this._saveMessages();
                                this._view?.webview.postMessage({ type: 'setMessages', messages: this._messages });
                            });
                        }
                    }
                    catch (e) {
                        vscode.window.showErrorMessage("Failed to load history: " + e.message);
                    }
                    break;
            }
        });
    }
    _getHtmlForWebview(webview) {
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>AI Assistant Chat</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        padding: 0;
                        margin: 0;
                        height: 100vh;
                        display: flex;
                        flex-direction: column;
                        background-color: var(--vscode-sideBar-background);
                        color: var(--vscode-sideBarTitle-foreground);
                    }
                    .chat-header {
                        display: flex;
                        gap: 8px;
                        padding: 10px;
                        background-color: var(--vscode-sideBar-background);
                        border-bottom: 1px solid var(--vscode-widget-border);
                    }
                    .chat-header button {
                        flex: 1;
                        background-color: var(--vscode-button-secondaryBackground);
                        color: var(--vscode-button-secondaryForeground);
                        border: 1px solid var(--vscode-button-border, transparent);
                        padding: 6px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                    }
                    .chat-header button:hover {
                        background-color: var(--vscode-button-secondaryHoverBackground);
                    }
                    #chat-container {
                        flex: 1;
                        overflow-y: auto;
                        padding: 10px;
                        display: flex;
                        flex-direction: column;
                        gap: 12px;
                    }
                    .message {
                        padding: 10px 14px;
                        border-radius: 6px;
                        max-width: 90%;
                        font-size: 13px;
                        line-height: 1.4;
                        word-wrap: break-word;
                    }
                    .message.user {
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        align-self: flex-end;
                        border-bottom-right-radius: 2px;
                    }
                    .message.assistant {
                        background-color: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                        align-self: flex-start;
                        border-bottom-left-radius: 2px;
                        border: 1px solid var(--vscode-widget-border);
                    }
                    .message.error {
                        background-color: var(--vscode-inputValidation-errorBackground);
                        color: var(--vscode-inputValidation-errorForeground);
                        border: 1px solid var(--vscode-inputValidation-errorBorder);
                        align-self: center;
                        font-family: monospace;
                    }
                    .message.system {
                        background-color: transparent;
                        color: var(--vscode-descriptionForeground);
                        align-self: flex-start;
                        font-style: italic;
                        padding: 4px 10px;
                    }
                    .code-block {
                        background-color: #1e1e1e;
                        color: #d4d4d4;
                        padding: 8px;
                        border-radius: 4px;
                        font-family: Consolas, monospace;
                        overflow-x: auto;
                        margin-top: 8px;
                    }
                    #input-container {
                        padding: 10px;
                        background-color: var(--vscode-sideBar-background);
                        border-top: 1px solid var(--vscode-widget-border);
                        display: flex;
                        gap: 8px;
                    }
                    #message-input {
                        flex: 1;
                        background-color: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        border: 1px solid var(--vscode-input-border);
                        padding: 8px;
                        border-radius: 4px;
                        font-family: var(--vscode-font-family);
                        resize: none;
                        height: 40px;
                    }
                    #message-input:focus {
                        outline: 1px solid var(--vscode-focusBorder);
                        border-color: var(--vscode-focusBorder);
                    }
                    #send-button {
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        padding: 8px 12px;
                        border-radius: 4px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    #send-button:hover {
                        background-color: var(--vscode-button-hoverBackground);
                    }
                    
                    /* Markdown Styles for Assistant Responses */
                    .message.assistant p { margin: 0 0 8px 0; }
                    .message.assistant p:last-child { margin-bottom: 0; }
                    .message.assistant pre { 
                        background-color: var(--vscode-textCodeBlock-background); 
                        padding: 8px; 
                        border-radius: 4px; 
                        overflow-x: auto;
                        margin: 8px 0;
                    }
                    .message.assistant code {
                        font-family: var(--vscode-editor-font-family);
                        font-size: 12px;
                        background-color: var(--vscode-textCodeBlock-background);
                        padding: 2px 4px;
                        border-radius: 3px;
                    }
                </style>
            </head>
            <body>
                <div class="chat-header">
                    <button id="new-chat-btn" title="Start a fresh chat">➕ New Chat</button>
                    <button id="history-btn" title="View past chats">🕒 History</button>
                </div>
                <div id="chat-container">
                    <div class="message system">Hello! I am your AI IDE Assistant. How can I help you code today?</div>
                </div>
                <div id="input-container">
                    <textarea id="message-input" placeholder="Ask Claude a question..." rows="1"></textarea>
                    <button id="send-button" title="Send (Enter)">➤</button>
                </div>
                
                <script>
                    const vscode = acquireVsCodeApi();
                    
                    const chatContainer = document.getElementById('chat-container');
                    const messageInput = document.getElementById('message-input');
                    const sendButton = document.getElementById('send-button');
                    const initialMessages = ${JSON.stringify(this._messages)};
                    
                    // Robust Markdown parser for UI
                    function parseMarkdown(text) {
                        if (!text) return '';
                        
                        // First extract code blocks to protect them
                        const codeBlocks = [];
                        let processedText = text.replace(/\`\`\`([\\s\\S]*?)\`\`\`/g, (match, code) => {
                            const index = codeBlocks.length;
                            // Escape HTML in code block
                            const safeCode = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                            
                            // Check for language tag
                            const lines = safeCode.split('\\n');
                            let langClass = '';
                            let finalCode = safeCode;
                            if (lines.length > 0 && !lines[0].includes(' ') && lines[0].length < 20) {
                                langClass = 'class="language-' + lines[0].trim() + '"';
                                finalCode = lines.slice(1).join('\\n');
                            }
                            
                            codeBlocks.push('<pre><code ' + langClass + '>' + finalCode + '</code></pre>');
                            return '__CODE_BLOCK_' + index + '__';
                        });

                        // Now escape HTML in the rest of the text
                        processedText = processedText.replace(/</g, '&lt;').replace(/>/g, '&gt;');

                        // Process normal markdown
                        processedText = processedText.replace(/\\n/g, '<br/>');
                        processedText = processedText.replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>');
                        processedText = processedText.replace(/\\*(.*?)\\*/g, '<em>$1</em>');
                        processedText = processedText.replace(/\`(.*?)\`/g, '<code>$1</code>');

                        // Restore code blocks
                        codeBlocks.forEach((block, index) => {
                            processedText = processedText.replace('__CODE_BLOCK_' + index + '__', block);
                        });

                        return processedText;
                    }

                    function scrollToBottom() {
                        chatContainer.scrollTop = chatContainer.scrollHeight;
                    }

                    function addMessage(role, content, id) {
                        try {
                            const div = document.createElement('div');
                            div.className = 'message ' + role;
                            if (id) {
                                div.id = id;
                            }
                            
                            if (role === 'assistant') {
                                div.innerHTML = parseMarkdown(content);
                            } else if (role === 'system' && content === 'thinking') {
                                div.innerText = 'Claude is thinking...';
                            } else {
                                // User or simple system message
                                div.innerText = content;
                            }
                            
                            chatContainer.appendChild(div);
                            scrollToBottom();
                        } catch (e) {
                            const errDiv = document.createElement('div');
                            errDiv.className = 'message error';
                            errDiv.innerText = 'UI Render Error: ' + e.toString() + '\\nContent:\\n' + content;
                            chatContainer.appendChild(errDiv);
                        }
                    }
                    
                    function removeMessage(id) {
                        const el = document.getElementById(id);
                        if (el) {
                            el.remove();
                        }
                    }

                    function sendMessage() {
                        const text = messageInput.value.trim();
                        if (text) {
                            vscode.postMessage({ type: 'sendMessage', value: text });
                            messageInput.value = '';
                            messageInput.style.height = '40px';
                        }
                    }

                    sendButton.addEventListener('click', sendMessage);

                    document.getElementById('new-chat-btn').addEventListener('click', () => {
                        vscode.postMessage({ type: 'newChat' });
                    });
                    
                    document.getElementById('history-btn').addEventListener('click', () => {
                        vscode.postMessage({ type: 'showHistory' });
                    });

                    messageInput.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                        }
                    });

                    // Auto-resize textarea
                    messageInput.addEventListener('input', function() {
                        this.style.height = '40px';
                        if (this.scrollHeight > 40 && this.scrollHeight < 150) {
                            this.style.height = this.scrollHeight + 'px';
                        } else if (this.scrollHeight >= 150) {
                            this.style.height = '150px';
                        }
                    });

                    // Handle messages sent from the extension to the webview
                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.type) {
                            case 'addMessage':
                                addMessage(message.role, message.content, message.id);
                                break;
                            case 'removeMessage':
                                removeMessage(message.id);
                                break;
                            case 'clearHistory':
                                chatContainer.innerHTML = '<div class="message system">Hello! I am your AI IDE Assistant. How can I help you code today?</div>';
                                break;
                            case 'setMessages':
                                chatContainer.innerHTML = '<div class="message system">Hello! I am your AI IDE Assistant. How can I help you code today?</div>';
                                message.messages.forEach(msg => {
                                    addMessage(msg.role, msg.content, null);
                                });
                                break;
                        }
                    });

                    // Load history on start
                    initialMessages.forEach(msg => {
                        addMessage(msg.role, msg.content, null);
                    });
                </script>
            </body>
            </html>`;
    }
}
exports.ChatViewProvider = ChatViewProvider;
ChatViewProvider.viewType = 'ai-assistant.chatView';
//# sourceMappingURL=chatProvider.js.map