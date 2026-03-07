# AI-IDE Integration - Visual Architecture Diagrams

## System Architecture (Mermaid)

```mermaid
graph TB
    subgraph IDE["VS Code IDE"]
        EXT[Extension TypeScript]
        CMD[Commands]
        DIAG[Diagnostics]
        UI[UI Components]
    end
    
    subgraph MCP["MCP Bridge Server Python/FastAPI"]
        HTTP[HTTP Endpoints]
        WS[WebSocket]
        TOOLS[MCP Tools]
        AI_MGR[AI Manager]
        SEC[Security Layer]
    end
    
    subgraph BROWSER["Headless Browser Playwright"]
        CHROME[Chromium]
        SESSION[Session Manager]
    end
    
    subgraph AI_SERVICES["Free AI Services"]
        CLAUDE[claude.ai]
        CHATGPT[chat.openai.com]
        GEMINI[gemini.google.com]
    end
    
    EXT --> HTTP
    EXT --> WS
    HTTP --> TOOLS
    TOOLS --> AI_MGR
    AI_MGR --> SEC
    SEC --> CHROME
    CHROME --> SESSION
    SESSION --> CLAUDE
    SESSION --> CHATGPT
    SESSION --> GEMINI
    
    style IDE fill:#e1f5ff
    style MCP fill:#fff3e0
    style BROWSER fill:#f3e5f5
    style AI_SERVICES fill:#e8f5e9
```

## Data Flow Diagram

```mermaid
sequenceDiagram
    participant User
    participant VSCode
    participant Extension
    participant MCPServer
    participant Browser
    participant AI
    
    User->>VSCode: Select code + "Analyze"
    VSCode->>Extension: Trigger command
    Extension->>Extension: Build context
    Extension->>MCPServer: POST /mcp/execute
    MCPServer->>MCPServer: Validate request
    MCPServer->>MCPServer: Build AI prompt
    MCPServer->>Browser: Send message
    Browser->>AI: Automated interaction
    AI-->>Browser: Response
    Browser-->>MCPServer: Extract response
    MCPServer->>MCPServer: Parse response
    MCPServer-->>Extension: Return structured data
    Extension-->>VSCode: Display results
    VSCode-->>User: Show analysis
```

## Component Architecture

```mermaid
graph LR
    subgraph Browser_Automation["Browser Automation Layer"]
        CLIENT[Client Base Class]
        CLAUDE_C[Claude Client]
        GPT_C[ChatGPT Client]
        GEMINI_C[Gemini Client]
        SESS[Session Manager]
        
        CLIENT --> CLAUDE_C
        CLIENT --> GPT_C
        CLIENT --> GEMINI_C
        CLAUDE_C --> SESS
        GPT_C --> SESS
        GEMINI_C --> SESS
    end
    
    subgraph MCP_Server["MCP Server Layer"]
        API[FastAPI App]
        TOOLS_M[Tool Handlers]
        CONTEXT[Context Builder]
        PARSER[Response Parser]
        CACHE[Cache Manager]
        
        API --> TOOLS_M
        TOOLS_M --> CONTEXT
        TOOLS_M --> PARSER
        PARSER --> CACHE
    end
    
    subgraph VSCode_Extension["VS Code Extension"]
        MAIN[Extension Main]
        MCP_CLIENT[MCP Client]
        CMD_REG[Command Registry]
        DIAG_MGR[Diagnostic Manager]
        STATUS[Status Bar]
        
        MAIN --> MCP_CLIENT
        MAIN --> CMD_REG
        MAIN --> DIAG_MGR
        MAIN --> STATUS
    end
    
    VSCode_Extension --> MCP_Server
    MCP_Server --> Browser_Automation
```

## Security Architecture

```mermaid
graph TD
    REQUEST[Incoming Request]
    AUTH{API Key Valid?}
    PATH{Path Safe?}
    CMD{Command Safe?}
    SIZE{File Size OK?}
    RATE{Rate Limit OK?}
    EXECUTE[Execute Request]
    REJECT[Reject Request]
    
    REQUEST --> AUTH
    AUTH -->|Yes| PATH
    AUTH -->|No| REJECT
    PATH -->|Yes| CMD
    PATH -->|No| REJECT
    CMD -->|Yes| SIZE
    CMD -->|No| REJECT
    SIZE -->|Yes| RATE
    SIZE -->|No| REJECT
    RATE -->|Yes| EXECUTE
    RATE -->|No| REJECT
    
    style EXECUTE fill:#c8e6c9
    style REJECT fill:#ffcdd2
```

## Request Processing Flow

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> ValidateRequest: New Request
    ValidateRequest --> BuildContext: Valid
    ValidateRequest --> Error: Invalid
    BuildContext --> CheckCache: Context Ready
    CheckCache --> ReturnCached: Cache Hit
    CheckCache --> QueryAI: Cache Miss
    QueryAI --> ParseResponse: AI Response
    ParseResponse --> UpdateCache: Parsed
    UpdateCache --> ReturnResult: Cached
    ReturnCached --> [*]
    ReturnResult --> [*]
    Error --> [*]
```

## Deployment Architecture

```mermaid
graph TB
    subgraph Production["Production Environment"]
        LB[Load Balancer nginx]
        
        subgraph Server_1["Server Instance 1"]
            MCP1[MCP Server]
            BROWSER1[Browser Pool]
        end
        
        subgraph Server_2["Server Instance 2"]
            MCP2[MCP Server]
            BROWSER2[Browser Pool]
        end
        
        subgraph Server_3["Server Instance 3"]
            MCP3[MCP Server]
            BROWSER3[Browser Pool]
        end
        
        CACHE_REDIS[(Redis Cache)]
        SESSION_DB[(Session Store)]
        METRICS[Prometheus]
        LOGS[Log Aggregation]
    end
    
    subgraph Clients["Client Machines"]
        IDE1[VS Code 1]
        IDE2[VS Code 2]
        IDE3[VS Code 3]
    end
    
    IDE1 --> LB
    IDE2 --> LB
    IDE3 --> LB
    
    LB --> MCP1
    LB --> MCP2
    LB --> MCP3
    
    MCP1 --> CACHE_REDIS
    MCP2 --> CACHE_REDIS
    MCP3 --> CACHE_REDIS
    
    MCP1 --> SESSION_DB
    MCP2 --> SESSION_DB
    MCP3 --> SESSION_DB
    
    MCP1 --> METRICS
    MCP2 --> METRICS
    MCP3 --> METRICS
    
    MCP1 --> LOGS
    MCP2 --> LOGS
    MCP3 --> LOGS
    
    style Production fill:#e3f2fd
    style Clients fill:#fff9c4
```

## Browser Automation Flow

```mermaid
flowchart TD
    START([Start Request])
    INIT{Browser Initialized?}
    LAUNCH[Launch Browser]
    AUTH{Authenticated?}
    LOGIN[Perform Login]
    NAVIGATE[Navigate to Chat]
    CHECK_CHAT{Chat Exists?}
    CREATE_CHAT[Create New Chat]
    SEND[Send Message]
    WAIT[Wait for Response]
    STABLE{Response Stable?}
    EXTRACT[Extract Response]
    PARSE[Parse Content]
    RETURN([Return Result])
    
    START --> INIT
    INIT -->|No| LAUNCH
    INIT -->|Yes| AUTH
    LAUNCH --> AUTH
    AUTH -->|No| LOGIN
    AUTH -->|Yes| NAVIGATE
    LOGIN --> NAVIGATE
    NAVIGATE --> CHECK_CHAT
    CHECK_CHAT -->|No| CREATE_CHAT
    CHECK_CHAT -->|Yes| SEND
    CREATE_CHAT --> SEND
    SEND --> WAIT
    WAIT --> STABLE
    STABLE -->|No| WAIT
    STABLE -->|Yes| EXTRACT
    EXTRACT --> PARSE
    PARSE --> RETURN
    
    style START fill:#c8e6c9
    style RETURN fill:#c8e6c9
    style LOGIN fill:#fff9c4
    style WAIT fill:#b3e5fc
```

## Error Handling Flow

```mermaid
graph TD
    ERROR[Error Occurred]
    TYPE{Error Type?}
    AUTH_ERR[Authentication Error]
    NETWORK_ERR[Network Error]
    TIMEOUT_ERR[Timeout Error]
    PARSE_ERR[Parse Error]
    
    RETRY{Can Retry?}
    FALLBACK{Fallback Available?}
    
    RE_AUTH[Re-authenticate]
    SWITCH_PROVIDER[Switch AI Provider]
    USE_CACHE[Use Cached Response]
    PARTIAL[Return Partial Result]
    FAIL[Fail Request]
    
    ERROR --> TYPE
    TYPE -->|Auth| AUTH_ERR
    TYPE -->|Network| NETWORK_ERR
    TYPE -->|Timeout| TIMEOUT_ERR
    TYPE -->|Parse| PARSE_ERR
    
    AUTH_ERR --> RE_AUTH
    RE_AUTH --> RETRY
    
    NETWORK_ERR --> RETRY
    TIMEOUT_ERR --> RETRY
    PARSE_ERR --> FALLBACK
    
    RETRY -->|Yes| SWITCH_PROVIDER
    RETRY -->|No| FALLBACK
    
    FALLBACK -->|Cache| USE_CACHE
    FALLBACK -->|Partial| PARTIAL
    FALLBACK -->|None| FAIL
    
    style ERROR fill:#ffcdd2
    style FAIL fill:#ef5350
    style USE_CACHE fill:#c8e6c9
```

## Multi-Provider Strategy

```mermaid
graph LR
    REQUEST[User Request]
    ROUTER{Task Router}
    
    subgraph Providers["AI Providers"]
        CLAUDE[Claude<br/>Code Generation]
        CHATGPT[ChatGPT<br/>Debugging]
        GEMINI[Gemini<br/>Explanation]
    end
    
    AGGREGATE[Aggregate Results]
    RESPONSE[Final Response]
    
    REQUEST --> ROUTER
    ROUTER -->|Code Gen| CLAUDE
    ROUTER -->|Debug| CHATGPT
    ROUTER -->|Explain| GEMINI
    
    CLAUDE --> AGGREGATE
    CHATGPT --> AGGREGATE
    GEMINI --> AGGREGATE
    
    AGGREGATE --> RESPONSE
    
    style REQUEST fill:#e1f5ff
    style RESPONSE fill:#c8e6c9
```

---

## ASCII Diagrams (for terminals/plain text)

### Simple Architecture
```
┌──────────────┐
│   VS Code    │
│  Extension   │
└──────┬───────┘
       │ HTTP
       ▼
┌──────────────┐
│ MCP Server   │
│  (Python)    │
└──────┬───────┘
       │ Playwright
       ▼
┌──────────────┐
│   Browser    │
│  Automation  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  claude.ai   │
│ chatgpt.com  │
└──────────────┘
```

### Data Flow
```
User → VS Code → Extension → MCP Server → Browser → AI Service
                                ↓
                           File System
                           ↓
                        Workspace Files
```

### Component Layers
```
┌─────────────────────────────────────────┐
│         Presentation Layer              │
│  (VS Code Extension, UI Components)     │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│         Business Logic Layer            │
│   (MCP Tools, Context Builder, etc.)    │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│       Integration Layer                 │
│   (Browser Automation, AI Clients)      │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│         External Services               │
│    (Claude, ChatGPT, Gemini)            │
└─────────────────────────────────────────┘
```

---

These diagrams can be rendered in:
- GitHub/GitLab README
- Confluence
- VS Code (with Mermaid extension)
- Documentation sites (MkDocs, Sphinx, etc.)
