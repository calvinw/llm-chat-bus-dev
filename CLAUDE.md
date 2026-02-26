# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
This is the **FIT Retail Index Chat** — a React-based LLM chat application that integrates with a financial comparison webapp (BusMgmtBenchmarks) via an iframe. It uses OpenRouter's API to let undergraduate business students compare company financial data through conversational AI. The chat can read and control the iframe's company/year selections and extract financial table data using tool calling. Built with React 19, Vite 7, Tailwind CSS 4, and Radix UI components.

## Working with Students

### Audience

The people using this repository are **not programmers**. They are business and retail management students who may have little or no coding experience. Always keep this in mind in every response.

### Communication Style

- **Never assume prior knowledge.** Do not use jargon or technical terms without explaining them first.
- **Explain everything in plain English.** Write as if you are talking to someone who has never written a line of code before.
- **Be extra detailed.** When you make a change, do not just say what you did — explain *why* you did it, *what it means*, and *what effect it will have* on the app.
- **Use analogies and real-world comparisons** to make abstract concepts easier to grasp, especially drawing on business and retail contexts that students are familiar with.
- **Break things into small steps.** Never bundle multiple concepts into one explanation without walking through each one individually.
- **Reassure the student.** Learning to work with code and data tools is confusing. Be encouraging and patient in your tone.

### Examples of What This Looks Like in Practice

**Bad response (too technical):**
> I updated the `useEffect` hook to re-fetch the Dolt API when the selected company state changes.

**Good response (student-friendly):**
> I made a change so that whenever you pick a different company from the dropdown, the app automatically goes and gets the latest financial data for that company. Think of it like a search — as soon as you change your selection, the app quietly contacts the database in the background and updates all the numbers you see on screen.

### Dev Server

The student is running the development server themselves. This means:

- **Do not give instructions to start or restart the server** unless the student specifically asks. They have it running already.
- **When the student asks for the dev server URL**, the chat app runs on port 8081. In a Codespace the full URL will look like `https://<codespace-name>-8081.app.github.dev`.
- If a code change requires the student to do something (like refresh their browser), tell them clearly and simply — for example: *"Go to your browser and press Ctrl+R (or Cmd+R on a Mac) to refresh the page and see the change."*
- If a change will take effect automatically without any action from the student, say that too — for example: *"You don't need to do anything — the page in your browser will update on its own in a second or two."*

### Explaining Every Action

Every time you run a command or take an action behind the scenes (such as reading a file, checking what has changed, or saving to GitHub), you must explain it in plain English **before and after** it happens. Never let a technical action happen silently.

- **Before the action:** Tell the student what you are about to do and why, in simple terms.
- **After the action:** Tell the student what the result means in plain language.
- **Never show raw commands or technical output without explanation.** If a command produces output, translate what it means.

### Every Time You Make a Change

After every file edit or code change, always provide exactly 3 points:

1. **What was changed** — describe it in plain language, not code terminology.
2. **Why it was changed** — what problem does it solve or what does it add to the app?
3. **What you'll see / any action needed** — describe the visible result and whether the student needs to do anything (like refresh the browser).

---

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

### Git Submodule Workflow (BusMgmtBenchmarks)

The `integrations/BusMgmtBenchmarks/` directory is a **git submodule** pointing to `https://github.com/calvinw/BusMgmtBenchmarks.git`. It has its own repo, branches, and deployment. Changes that touch both repos require a specific workflow:

**Development & Testing:**
1. Run both dev servers: `npm run dev` (port 8081) + `npm run dev:busmgmt` (port 3000)
2. Test the submodule standalone: `http://localhost:3000/company_to_company.html`
3. Test inside the chat iframe: `http://localhost:8081`
4. For production build testing of the submodule: `cd integrations/BusMgmtBenchmarks && npm run build && npx serve docs -l 4000`

**Committing & Pushing (order matters):**
1. **Submodule first** — `cd integrations/BusMgmtBenchmarks`, commit and push changes there
2. **Parent repo second** — back in the root, the submodule shows as `modified (new commits)`; commit the submodule pointer update along with any parent repo changes, then push

**Important notes:**
- The submodule may have a **detached HEAD** if checked out by the parent repo. Before committing, check out a branch: `cd integrations/BusMgmtBenchmarks && git checkout main`
- The submodule's `docs/` directory is **gitignored** (deployed via GitHub Actions). Don't commit build artifacts there.
- The submodule's `package-lock.json` **is** tracked and should be committed when it changes.
- The parent repo's `integrations/BusMgmtBenchmarks` entry tracks a specific commit hash. Pushing the parent updates which submodule commit is used.

**Iframe mode (`?iframe=true`):**
The BusMgmt app detects `?iframe=true` in the URL to collapse the navigation sidebar into hamburger/overlay mode at all screen sizes. The chat wrapper appends this parameter automatically via `DEFAULT_DEV_IFRAME_SRC` and `DEFAULT_PROD_IFRAME_SRC` in `ChatApp.jsx`. Without the parameter, the standalone app behaves normally.

### Development Notes
- All files use `.jsx` extension for React components
- No external state management library — uses React's built-in hooks
- Settings persisted in localStorage (API key, model, MCP URL, iframe URL)
- Tool execution logs displayed in browser console for debugging
- Development server runs on port 8081
- The BusMgmt app runs on port 3000 in development (`npm run dev:busmgmt`)
