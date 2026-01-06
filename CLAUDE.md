# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
This is a React-based LLM chat interface component that uses OpenRouter's API. The application supports streaming responses, multiple models, markdown rendering with MathJax support, tool calling, and MCP (Model Context Protocol) integration. Built with React 19, Vite, Tailwind CSS 4, and Radix UI components.

## Common Commands

**Development Server:**
```bash
npm run dev          # Starts Vite dev server on port 8081 with hot reload
```

**Production Build:**
```bash
npm run build        # Builds to /docs directory for deployment
npm run preview      # Preview production build
```

## Architecture

### Core Structure
This is a **React component library** designed as a reusable chat interface. The main export is `LLMChatInterface.jsx` which can be embedded in other React applications or used standalone.

### Key Components

**Main Component (`LLMChatInterface.jsx`):**
- Root component that orchestrates all chat functionality
- Manages API key persistence in localStorage
- Handles display modes (markdown/text) and error states
- Uses composition pattern with custom hooks for functionality
- Supports configurable sidebar position (left/right)

**Custom Hooks Architecture:**
- **`useChatEngine.jsx`**: Core chat logic with streaming support, message management, and OpenRouter API integration
- **`useModelManager.jsx`**: Handles fetching available models from OpenRouter API or using custom model lists
- **`useMarkdownRenderer.jsx`**: Manages markdown rendering with MathJax support
- **`useToolManager.jsx`**: Manages parallel tool execution with error handling and validation
- **`useMCPManager.jsx`**: Manages MCP (Model Context Protocol) server connections and remote tools
- **`useStreamingEngine.jsx`**: Handles streaming response processing and throttling

**Component Structure:**
- **`Sidebar.jsx`**: Model selection, API key input, MCP configuration, display mode toggle
- **`MessagesContainer.jsx`**: Message display with auto-scrolling and streaming support
- **`MessageInput.jsx`**: Input area with send functionality and auto-resize
- **`Message.jsx`**: Individual message rendering with tool execution display
- **`ErrorDisplay.jsx`**: Error handling and display
- **`TabHeader.jsx`**: Tab navigation for different views
- **`SystemPromptTab.jsx`**: System prompt configuration
- **`ui/`**: Radix UI components (Button, Select, Dialog, etc.)
- **`ai-elements/`**: AI-specific UI elements (code blocks, loaders, etc.)

**Utilities:**
- **`apiClient.jsx`**: OpenRouter API client with streaming and non-streaming support
- **`mcpClient.jsx`**: MCP protocol client for external tool servers
- **`httpClient.jsx`**: HTTP utility functions
- **`mathProcessor.jsx`**: MathJax integration utilities
- **`constants.jsx`**: Application constants and configuration
- **`lib/utils.js`**: Helper functions and utilities

### Key Features
- **React 19** - Latest React with modern hooks and features
- **Vite Build System** - Fast development and optimized production builds
- **Tailwind CSS 4** - Utility-first CSS with Vite plugin
- **Radix UI** - Accessible, customizable component primitives
- **Streaming Responses** - Real-time message streaming with throttled updates
- **Tool Calling** - Parallel tool execution with local and remote (MCP) tools
- **Math Rendering** - MathJax support for LaTeX expressions with $ and $$ delimiters
- **State Management** - Custom hooks pattern for modular state management
- **API Integration** - OpenRouter API with proper CORS headers and error handling
- **Component Reusability** - Designed as embeddable React component with props API

### Development Notes
- Uses React 19.2.1 with JSX syntax
- Vite 7 for development server and production builds
- No external state management library - uses React's built-in hooks
- CSS handled by Tailwind CSS 4 with Vite plugin
- All files use `.jsx` extension for React components
- API key persisted in localStorage with automatic state synchronization
- Tool execution logs displayed in browser console for debugging
- Development server runs on port 8081
- Production builds output to `/docs` directory for GitHub Pages

### File Structure
```
src/
├── main.jsx                    # App entry point with tool examples
├── LLMChatInterface.jsx        # Main chat component
├── index.css                   # Global styles and Tailwind imports
├── components/                 # React components
│   ├── Sidebar.jsx            # Model selection & settings
│   ├── MessagesContainer.jsx  # Message display
│   ├── MessageInput.jsx       # Input area
│   ├── Message.jsx            # Individual message
│   ├── ErrorDisplay.jsx       # Error handling
│   ├── TabHeader.jsx          # Tab navigation
│   ├── SystemPromptTab.jsx    # System prompt config
│   ├── ui/                    # Radix UI components
│   └── ai-elements/           # AI-specific UI elements
├── hooks/                      # Custom React hooks
│   ├── useChatEngine.jsx      # Core chat logic
│   ├── useModelManager.jsx    # Model fetching
│   ├── useMarkdownRenderer.jsx # Markdown/math rendering
│   ├── useMCPManager.jsx      # MCP protocol
│   ├── useStreamingEngine.jsx # Streaming responses
│   └── useToolManager.jsx     # Tool execution
├── utils/                      # Utilities
│   ├── apiClient.jsx          # OpenRouter API
│   ├── mcpClient.jsx          # MCP client
│   ├── httpClient.jsx         # HTTP utilities
│   ├── mathProcessor.jsx      # MathJax integration
│   └── constants.jsx          # App constants
└── lib/
    └── utils.js               # Helper functions
```

### API Integration Details
- **Base URL**: `https://openrouter.ai/api/v1/chat/completions`
- **Streaming**: Uses Server-Sent Events with custom throttling (every 6th chunk)
- **Headers**: Includes HTTP-Referer and X-Title for OpenRouter requirements
- **Error Handling**: Comprehensive error handling with fallback to non-streaming mode
- **Default Model**: `openai/gpt-4o-mini`
- **Dependencies**: Managed via npm, bundled by Vite

### JSX Syntax
The project uses standard React JSX:

```javascript
// JSX component
return (
  <div className="chat">
    Hello {name}
  </div>
);

// Components
return <Component prop={value} />;

// Conditional rendering
return (
  <>
    {condition && <div>Content</div>}
  </>
);

// Lists/mapping
return (
  <>
    {items.map(item => (
      <div key={item.id}>{item.name}</div>
    ))}
  </>
);
```

### Deployment Options

**Development:**
- `npm run dev` - Vite development server with hot reloading (port 8081)

**Production:**
- `npm run build` - Build to `/docs` directory
- GitHub Pages - Deploy from `/docs` folder
- Netlify/Vercel - Connect to repository
- Any static hosting - Upload built files from `/docs`

### Component Props API

The `LLMChatInterface` component accepts the following props:

```jsx
<LLMChatInterface
  apiKey={string}                    // OpenRouter API key (uses localStorage if not provided)
  defaultModel={string}              // Default model to use
  systemPrompt={string}              // System prompt for conversation
  tools={array}                      // Tool definitions (OpenAI format)
  toolHandlers={object}              // Tool implementation functions
  enableTools={boolean}              // Enable tool calling
  toolChoice={string}                // Tool choice strategy ("auto", "required", "none")
  parallelToolCalls={boolean}        // Allow parallel tool execution
  onToolCall={function}              // Callback for tool execution events
  customModels={array}               // Custom model list (overrides OpenRouter)
  className={string}                 // Additional CSS classes
  height={string}                    // Component height
  showHeader={boolean}               // Show header section
  showModelSelector={boolean}        // Show model selector
  showClearButton={boolean}          // Show clear messages button
  showDisplayModeToggle={boolean}    // Show markdown/text toggle
  onMessage={function}               // Callback for new messages
  onError={function}                 // Callback for errors
  theme={string}                     // UI theme
  sidebarPosition={string}           // Sidebar position ("left" or "right")
/>
```

### Tool Calling

Tools follow the OpenAI function calling format:

```javascript
const tools = [
  {
    type: "function",
    function: {
      name: "tool_name",
      description: "Tool description",
      parameters: {
        type: "object",
        properties: {
          param: {
            type: "string",
            description: "Parameter description"
          }
        },
        required: ["param"]
      }
    }
  }
];

const toolHandlers = {
  tool_name: ({ param }) => {
    // Implementation
    return { result: "value" };
  }
};
```

### MCP (Model Context Protocol)

The interface supports connecting to MCP servers for remote tools:

- **SSE Transport**: Server-Sent Events for streaming
- **HTTP Transport**: Standard HTTP requests
- **Auto-discovery**: Tools are automatically discovered from connected servers
- **Python Server**: Example MCP server included (`mcp_server.py`)

### Styling

- **Tailwind CSS 4**: Utility-first CSS framework
- **Custom CSS**: Global styles in `src/index.css`
- **Radix UI**: Pre-styled accessible components
- **Dark Mode**: Theme support (currently light theme)
- **Responsive**: Mobile-first design approach

### Build Configuration

**Vite Configuration (`vite.config.js`):**
```javascript
{
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": "./src" }
  },
  base: './',              // For GitHub Pages
  build: {
    outDir: 'docs',        // Output directory
    emptyOutDir: true
  },
  server: {
    port: 8081
  }
}
```

### Important Technical Details

**Package Dependencies:**
- React 19.2.1 and React DOM 19.2.1
- Vite 7 for build tooling
- Tailwind CSS 4 with Vite plugin
- Radix UI component libraries
- markdown-it for markdown rendering
- MathJax 3 for math typesetting
- Various utility libraries (nanoid, clsx, etc.)

**Development Workflow:**
1. Edit `.jsx` files in `src/`
2. Vite hot reloads changes automatically
3. Use browser DevTools for debugging
4. Check console for tool execution logs
5. Build with `npm run build` before deployment

**Production Builds:**
- Optimized and minified JavaScript
- CSS extracted and minified
- Assets hashed for cache busting
- Source maps generated for debugging
- Output in `/docs` directory

This architecture provides a modern React development experience with fast development builds, optimized production output, and comprehensive feature support for LLM chat interfaces.
