"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPClient = void 0;
const axios_1 = require("axios");
const vscode = require("vscode");
class MCPClient {
    constructor() {
        const config = vscode.workspace.getConfiguration('ai-assistant');
        this.serverUrl = config.get('serverUrl') || 'http://localhost:8000';
        this.client = axios_1.default.create({
            baseURL: this.serverUrl,
            timeout: 180000, // 3 minutes for AI responses
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
    async execute(request) {
        try {
            const response = await this.client.post('/mcp/execute', request);
            return response.data;
        }
        catch (error) {
            console.error('MCP request failed:', error);
            let errMsg = 'Unknown error';
            if (error.response) {
                // Server responded with non-2xx status
                errMsg = `Server Error ${error.response.status}: ${JSON.stringify(error.response.data)}`;
            }
            else if (error.request) {
                // Request made but no response received
                errMsg = 'No response received from server. Is it running?';
            }
            else {
                // Something happened in setting up the request that triggered an Error
                errMsg = error.message;
            }
            throw new Error(`MCP request failed: ${errMsg}`);
        }
    }
    async readFile(path) {
        const response = await this.execute({
            tool: 'read_file',
            parameters: { path }
        });
        if (!response.success || !response.data) {
            throw new Error(response.error || 'Failed to read file');
        }
        return response.data.content;
    }
    async writeFile(path, content, backup = true) {
        const response = await this.execute({
            tool: 'write_file',
            parameters: { path, content, backup }
        });
        if (!response.success) {
            throw new Error(response.error || 'Failed to write file');
        }
    }
    async analyzeCode(path, analysisType = 'general', context) {
        const response = await this.execute({
            tool: 'analyze_code',
            parameters: { path, type: analysisType },
            context
        });
        if (!response.success || !response.data) {
            throw new Error(response.error || 'Failed to analyze code');
        }
        return response.data;
    }
    async suggestFix(path, error, snippet) {
        const response = await this.execute({
            tool: 'suggest_fix',
            parameters: { path, error, snippet }
        });
        if (!response.success || !response.data) {
            throw new Error(response.error || 'Failed to get suggestions');
        }
        return response.data;
    }
    async askAI(query, context) {
        const response = await this.execute({
            tool: 'ai_query',
            parameters: { query, include_context: true },
            context
        });
        if (!response.success || !response.data) {
            throw new Error(response.error || 'AI query failed');
        }
        return response.data.response;
    }
    async executeCommand(command, cwd) {
        const response = await this.execute({
            tool: 'execute_command',
            parameters: { command, cwd }
        });
        if (!response.success || !response.data) {
            throw new Error(response.error || 'Command execution failed');
        }
        return response.data;
    }
    async setWorkspace(path, projectType) {
        try {
            await this.client.post('/config/workspace', {
                path,
                project_type: projectType
            });
        }
        catch (error) {
            throw new Error(`Failed to set workspace: ${error.message}`);
        }
    }
    async runAgentTask(objective, context) {
        // Use a longer timeout for agentic loops since they run multiple sub-turns (e.g. 15 minutes)
        const oldTimeout = this.client.defaults.timeout;
        this.client.defaults.timeout = 900000;
        try {
            const response = await this.execute({
                tool: 'agent_task',
                parameters: { objective },
                context
            });
            this.client.defaults.timeout = oldTimeout;
            if (!response.success || !response.data) {
                throw new Error(response.error || 'Agent task failed');
            }
            // Extract the final summary string and the frontend actions queue
            return {
                summary: response.data.final_summary || JSON.stringify(response.data),
                actions: response.data.frontend_actions || []
            };
        }
        catch (err) {
            this.client.defaults.timeout = oldTimeout;
            throw err;
        }
    }
    async newChat() {
        await this.execute({
            tool: 'new_chat',
            parameters: {}
        });
    }
    async listChats(limit = 20) {
        const response = await this.execute({
            tool: 'list_chats',
            parameters: { limit }
        });
        if (!response.success || !response.data) {
            throw new Error(response.error || 'Failed to list chats');
        }
        return response.data.chats || [];
    }
    async switchChat(chatId) {
        const oldTimeout = this.client.defaults.timeout;
        this.client.defaults.timeout = 180000; // 3 mins for history payload
        try {
            const response = await this.execute({
                tool: 'switch_chat',
                parameters: { chat_id: chatId }
            });
            this.client.defaults.timeout = oldTimeout;
            if (!response.success || !response.data) {
                throw new Error(response.error || 'Failed to switch chat');
            }
            return response.data.history || [];
        }
        catch (err) {
            this.client.defaults.timeout = oldTimeout;
            throw err;
        }
    }
    async checkHealth() {
        try {
            const response = await this.client.get('/health');
            return response.data.status === 'healthy';
        }
        catch {
            return false;
        }
    }
}
exports.MCPClient = MCPClient;
//# sourceMappingURL=mcpClient.js.map