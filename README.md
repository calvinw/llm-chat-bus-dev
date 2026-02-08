# FIT Retail Index Chat

A React-based LLM chat application that integrates with the BusMgmtBenchmarks financial comparison webapp. Students can compare company financial data through conversational AI, with the chat reading and controlling an embedded iframe showing financial metrics. Built with React 19, Vite 7, Tailwind CSS 4, and Radix UI.

## Features

- **Financial Data Integration** - Chat reads/controls company selections and extracts financial table data from the embedded BusMgmt app via postMessage bridge
- **Multiple LLM Support** - Access GPT-4, Claude, Gemini, Llama, and more via OpenRouter
- **Streaming Responses** - Real-time SSE streaming with tool call chaining (up to 20 rounds)
- **Tool Calling** - Three built-in tools for iframe interaction, plus MCP remote tools
- **MCP Integration** - Model Context Protocol support with dual transport auto-detection
- **Math Rendering** - LaTeX expressions with KaTeX (`$inline$` and `$$display$$`)
- **Markdown Support** - Streaming markdown rendering with Shiki syntax highlighting
- **Resizable Split Pane** - Side-by-side iframe + chat layout with draggable divider
- **Conversation Export** - Save conversations as markdown (compact or detailed)

## Quick Start

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
git clone <repository-url>
cd llm-chat-bus-dev
npm install
npm run setup:integration   # Init BusMgmt submodule + install its dependencies
```

### Development

Run both servers in separate terminals:

```bash
# Terminal A: Chat wrapper (http://localhost:8081)
npm run dev

# Terminal B: BusMgmt app (http://localhost:3000)
npm run dev:busmgmt
```

### Build for Production

```bash
# Full build: wrapper + BusMgmt submodule + sync assets to /docs
npm run build

# Preview the integrated build
npm run preview:integration
```

## Project Structure

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
│   │   ├── code-block.jsx      # Syntax-highlighted code blocks (Shiki)
│   │   └── ...                 # loader, reasoning, sources, suggestion, shimmer, model-selector
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
└── lib/
    └── utils.js                # cn() helper function
integrations/
└── BusMgmtBenchmarks/          # Git submodule - financial comparison webapp
scripts/
└── sync-busmgmt-assets.mjs     # Copies BusMgmt build output to docs/busmgmt/
```

## Built-in Tools

Three tools interact with the BusMgmt iframe:

| Tool | Description |
|------|-------------|
| `get_selected_companies` | Gets the current company/year dropdown selections |
| `set_selected_companies` | Sets company and/or year selections (company1, year1, company2, year2) |
| `get_financial_data` | Extracts the financial comparison table data |

Tools use a postMessage bridge (`busmgmt.bridge.request` / `busmgmt.bridge.response`) with same-origin DOM fallback.

## BusMgmt Integration

The financial comparison app ([BusMgmtBenchmarks](https://github.com/calvinw/BusMgmtBenchmarks)) is integrated as a git submodule at `integrations/BusMgmtBenchmarks`.

- **Dev iframe**: `http://localhost:3000/company_to_company.html`
- **Prod iframe**: `./busmgmt/company_to_company.html`

### Optional iframe environment overrides

- `VITE_IFRAME_SRC`: full override for all modes
- `VITE_IFRAME_SRC_DEV`: dev default (used when `VITE_IFRAME_SRC` is not set)
- `VITE_IFRAME_SRC_PROD`: production default (used when `VITE_IFRAME_SRC` is not set)

## API Configuration

### OpenRouter API Key

1. Sign up at [openrouter.ai](https://openrouter.ai/)
2. Generate an API key
3. Enter it in Settings (stored in localStorage)

### MCP Server

Configure an MCP server URL in Settings to add remote database tools. The default connects to the BusMgmt Dolt database server. An example Python MCP server is included (`mcp_server.py`).

## Deployment

### GitHub Pages

Deployment is automatic via **GitHub Actions**. On every push to `main`, the workflow (`.github/workflows/deploy.yml`) builds the app and deploys to GitHub Pages. No build artifacts are committed to the repo.

## Tech Stack

- **React 19** - UI framework
- **Vite 7** - Build tool and dev server
- **Tailwind CSS 4** - Utility-first CSS
- **Radix UI** - Accessible component primitives
- **KaTeX** - Math typesetting (via remark-math + rehype-katex)
- **Shiki** - Syntax highlighting
- **markdown-it** + **streamdown** - Markdown rendering
- **react-resizable-panels** - Split pane layout
- **Lucide React** - Icons
- **Motion** - Animations

## Troubleshooting

### API Key Issues
- Ensure your OpenRouter API key is valid
- Check that it's saved in localStorage (`openrouter_api_key`)
- Try refreshing the page

### Iframe / Tool Issues
- Make sure the BusMgmt dev server is running (`npm run dev:busmgmt`)
- Check browser console for bridge timeout errors
- Verify iframe URL in Settings

### MCP Connection Issues
- Verify MCP server is running and URL is correct
- Transport type is auto-detected (streamable-http or SSE legacy)
- Check CORS configuration on the server
