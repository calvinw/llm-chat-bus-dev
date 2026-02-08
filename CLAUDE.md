# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
This is the **FIT Retail Index Chat** — a React-based LLM chat application that integrates with a financial comparison webapp (BusMgmtBenchmarks) via an iframe. It uses OpenRouter's API to let undergraduate business students compare company financial data through conversational AI. The chat can read and control the iframe's company/year selections and extract financial table data using tool calling. Built with React 19, Vite 7, Tailwind CSS 4, and Radix UI components.

## Common Commands

**Development:**
```bash
npm run dev              # Starts Vite dev server on port 8081 with hot reload
npm run dev:busmgmt      # Starts the BusMgmt submodule dev server
```

**Production Build:**
```bash
npm run build            # Full build: wrapper + BusMgmt submodule + sync assets to /docs
npm run build:wrapper    # Build only the chat wrapper app
npm run build:busmgmt    # Build only the BusMgmt submodule
npm run sync:busmgmt     # Copy BusMgmt build assets into docs/busmgmt/
npm run preview          # Preview production build
```

**Setup:**
```bash
npm run setup:integration  # Init git submodule + install BusMgmt dependencies
```

## Architecture

### Core Structure
This is a **monolithic chat application** with an integrated iframe for financial data visualization. The main component is `ChatApp.jsx`, which manages all application state internally (no props API). It uses a split-pane layout with the BusMgmt comparison app on the left and the chat interface on the right.

### Key Components

**Main Component (`ChatApp.jsx`):**
- Root component that orchestrates all chat functionality
- Manages settings (API key, model, MCP URL, iframe URL) in localStorage
- Defines tool definitions and handlers for interacting with the iframe
- Uses `react-resizable-panels` for split-pane layout (iframe + chat)
- Communicates with iframe via postMessage bridge (with DOM fallback for same-origin)
- Includes suggested prompts for quick testing
- Supports conversation export to markdown (compact and detailed)

**Custom Hooks:**
- **`useOpenRouterChat.jsx`**: Core chat logic — direct fetch to OpenRouter API with SSE streaming, parallel tool execution via `Promise.all`, unlimited tool call chaining (up to 20 rounds), and AI Elements compatible parts structure
- **`useModelManager.jsx`**: Fetches available models from OpenRouter API with fallback defaults (GPT-4o Mini, GPT-4o, Claude 3.5 Sonnet)
- **`useMCPManager.jsx`**: Manages MCP server connections with auto-detection of transport type (streamable-http vs SSE legacy), debounced connection (1s)

**AI Element Components (`components/ai-elements/`):**
- **`conversation.jsx`**: Conversation wrapper with auto-scroll (uses `use-stick-to-bottom`)
- **`message.jsx`**: Message display with `MessageContent`, `MessageResponse`, `MessageActions`, `MessageBranch`
- **`prompt-input.jsx`**: Input area with `PromptInputTextarea`, `PromptInputSubmit`, `PromptInputFooter`, `PromptInputTools`
- **`tool.jsx`**: Tool execution display with `ToolHeader`, `ToolContent`, `ToolInput`, `ToolOutput`
- **`code-block.jsx`**: Syntax-highlighted code blocks using Shiki (`github-dark` theme)
- **`loader.jsx`**: Loading indicators
- **`reasoning.jsx`**: Reasoning display
- **`sources.jsx`**: Source citations
- **`suggestion.jsx`**: Suggested prompts
- **`shimmer.jsx`**: Shimmer loading effect
- **`model-selector.jsx`**: Model selection component

**UI Components (`components/ui/`):**
Radix UI wrapper components: `avatar`, `badge`, `button`, `button-group`, `card`, `collapsible`, `command`, `dialog`, `dropdown-menu`, `hover-card`, `input`, `input-group`, `label`, `scroll-area`, `select`, `separator`, `sheet`, `textarea`, `tooltip`

**Utilities:**
- **`mcpClient.jsx`**: MCP protocol client with dual transport support (streamable-http and SSE legacy) and auto-detection
- **`httpClient.jsx`**: HTTP utility functions (POST/GET, MCP headers, SSE parsing)
- **`mathProcessor.jsx`**: KaTeX math preprocessing — protects LaTeX expressions (`$$...$$`, `$...$`, `\[...\]`, `\(...\)`) from markdown corruption using placeholder replacement
- **`exportMarkdown.jsx`**: Conversation export to markdown with compact and detailed modes
- **`systemPrompt.js`**: System prompt module for the financial comparison assistant (role, data architecture, tool instructions, database schema, industry context for 56 retail companies across 10 segments)
- **`lib/utils.js`**: `cn()` helper for class name merging (clsx + tailwind-merge)

### Iframe Bridge Architecture
The chat communicates with the BusMgmt iframe using a postMessage bridge:
- **Request type**: `busmgmt.bridge.request`
- **Response type**: `busmgmt.bridge.response`
- **Actions**: `get_selection`, `set_selection`, `get_financial_data`
- Falls back to direct DOM access for same-origin iframes
- Dev default: `http://localhost:3000/company_to_company.html`
- Prod default: `./busmgmt/company_to_company.html`

### Tool Calling
Three built-in tools interact with the BusMgmt iframe:

- **`get_selected_companies`**: Gets the current company/year dropdown selections from the comparison iframe
- **`set_selected_companies`**: Sets company and/or year dropdown selections (company1, year1, company2, year2). Valid years: 2018-2024
- **`get_financial_data`**: Extracts the financial comparison table data (financial numbers and indicators for both companies)

Tools follow the OpenAI function calling format. MCP remote tools are merged with local tools at runtime.

### MCP (Model Context Protocol)
- **Dual transport**: Streamable HTTP and SSE legacy with auto-detection
- **Default server**: `https://bus-mgmt-databases.mcp.mathplosion.com/mcp-dolt-database/sse`
- **Auto-discovery**: Tools discovered from connected servers and merged with local tools
- **CORS proxy support**: Optional proxy for cross-origin MCP servers
- **Python server**: Example MCP server included (`mcp_server.py`)

### Key Features
- **React 19** with JSX syntax
- **Vite 7** for development and production builds
- **Tailwind CSS 4** with Vite plugin
- **Radix UI** accessible component primitives
- **Streaming Responses** via SSE with real-time message updates
- **Tool Calling** with parallel execution and chaining (up to 20 rounds)
- **Math Rendering** using KaTeX (`remark-math` + `rehype-katex`) for LaTeX expressions
- **Code Highlighting** using Shiki with `github-dark` theme
- **Markdown Rendering** using `markdown-it` and `streamdown` for streaming incremental rendering
- **Resizable Split Pane** layout with iframe + chat panels
- **Conversation Export** to markdown (compact and detailed modes)
- **Lucide React** icons throughout the UI
- **Motion** (Framer Motion) for animations

### File Structure
```
src/
├── main.jsx                    # App entry point (renders ChatApp)
├── ChatApp.jsx                 # Main chat application component
├── index.css                   # Global styles and Tailwind imports
├── components/
│   ├── ai-elements/            # AI chat UI components
│   │   ├── conversation.jsx    # Conversation wrapper with auto-scroll
│   │   ├── message.jsx         # Message display
│   │   ├── prompt-input.jsx    # Chat input area
│   │   ├── tool.jsx            # Tool execution display
│   │   ├── code-block.jsx      # Syntax-highlighted code blocks
│   │   ├── loader.jsx          # Loading indicators
│   │   ├── reasoning.jsx       # Reasoning display
│   │   ├── sources.jsx         # Source citations
│   │   ├── suggestion.jsx      # Suggested prompts
│   │   ├── shimmer.jsx         # Shimmer loading effect
│   │   └── model-selector.jsx  # Model selection
│   └── ui/                     # Radix UI wrapper components (19 files)
├── hooks/
│   ├── useOpenRouterChat.jsx   # Core chat logic with streaming + tool calling
│   ├── useModelManager.jsx     # OpenRouter model fetching
│   └── useMCPManager.jsx       # MCP server connection management
├── utils/
│   ├── mcpClient.jsx           # MCP protocol client (dual transport)
│   ├── httpClient.jsx          # HTTP utilities
│   ├── mathProcessor.jsx       # KaTeX math preprocessing
│   ├── exportMarkdown.jsx      # Conversation export
│   └── systemPrompt.js         # Financial assistant system prompt
├── lib/
│   └── utils.js                # cn() helper function
integrations/
└── BusMgmtBenchmarks/          # Git submodule - financial comparison webapp
scripts/
└── sync-busmgmt-assets.mjs     # Copies BusMgmt build output to docs/busmgmt/
```

### API Integration Details
- **Base URL**: `https://openrouter.ai/api/v1/chat/completions`
- **Streaming**: Direct fetch with SSE parsing (no EventSource)
- **Headers**: `Authorization`, `HTTP-Referer`, `X-Title` ("FIT Retail Index Chat")
- **Default Model**: `openai/gpt-4o-mini`
- **API Key**: Stored in `localStorage` as `openrouter_api_key`
- **Model Selection**: Stored in `localStorage` as `openrouter_model`

### Build Configuration

**Vite Configuration (`vite.config.js`):**
```javascript
{
  plugins: [react(), tailwindcss(), viteStaticCopy({ targets: [{ src: 'llm_prompt.md', dest: '.' }] })],
  resolve: { alias: { "@": "./src" } },
  base: './',
  build: { outDir: 'docs', emptyOutDir: true },
  server: { port: 8081 }
}
```

**Full build pipeline** (`npm run build`):
1. `build:wrapper` — Vite builds the chat app to `/docs`
2. `build:busmgmt` — Builds the BusMgmt submodule
3. `sync:busmgmt` — Copies BusMgmt build output into `docs/busmgmt/`

### Deployment
Production deployment is handled automatically by **GitHub Actions** (`.github/workflows/deploy.yml`). On every push to `main`, the workflow checks out the repo with submodules, runs `npm run build`, and deploys to GitHub Pages. The `docs/` directory is gitignored — no build artifacts are committed to the repo.

### Development Notes
- All files use `.jsx` extension for React components
- No external state management library — uses React's built-in hooks
- Settings persisted in localStorage (API key, model, MCP URL, iframe URL)
- Tool execution logs displayed in browser console for debugging
- Development server runs on port 8081
- The BusMgmt app runs on port 3000 in development (`npm run dev:busmgmt`)
