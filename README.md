# LLM Chat Interface

A modern, feature-rich React chat interface for Large Language Models using the OpenRouter API. Built with React 19, Vite, Tailwind CSS, and Radix UI components.

## Features

- **Multiple LLM Support** - Access GPT-4, Claude, Gemini, Llama, and more via OpenRouter
- **Streaming Responses** - Real-time message streaming with throttled updates
- **Tool Calling** - Support for function calling with parallel execution
- **MCP Integration** - Model Context Protocol support for remote tool servers
- **Math Rendering** - LaTeX expressions with MathJax ($inline$ and $$display$$)
- **Markdown Support** - Full markdown rendering with syntax highlighting
- **Responsive Design** - Mobile-friendly interface with configurable sidebar
- **Radix UI Components** - Accessible, customizable UI components
- **Tailwind CSS v4** - Modern utility-first styling

## Quick Start

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd llm-chat

# Install dependencies
npm install
```

### Development

```bash
# Start development server (http://localhost:8081)
npm run dev
```

### Build for Production

```bash
# Build to /docs directory (GitHub Pages ready)
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
llm-chat/
├── src/
│   ├── main.jsx                    # Application entry point
│   ├── LLMChatInterface.jsx        # Main chat component
│   ├── index.css                   # Global styles
│   ├── components/                 # React components
│   │   ├── Sidebar.jsx            # Settings and model selection
│   │   ├── MessagesContainer.jsx  # Message display area
│   │   ├── MessageInput.jsx       # User input component
│   │   ├── Message.jsx            # Individual message display
│   │   ├── ErrorDisplay.jsx       # Error handling UI
│   │   ├── TabHeader.jsx          # Tab navigation
│   │   ├── SystemPromptTab.jsx    # System prompt configuration
│   │   ├── ui/                    # Radix UI components
│   │   └── ai-elements/           # AI-specific UI elements
│   ├── hooks/                     # Custom React hooks
│   │   ├── useChatEngine.jsx      # Core chat logic
│   │   ├── useModelManager.jsx    # Model fetching/management
│   │   ├── useMarkdownRenderer.jsx # Markdown + MathJax
│   │   ├── useToolManager.jsx     # Tool execution
│   │   ├── useMCPManager.jsx      # MCP protocol handling
│   │   └── useStreamingEngine.jsx # Streaming responses
│   ├── utils/                     # Utility modules
│   │   ├── apiClient.jsx          # OpenRouter API client
│   │   ├── mcpClient.jsx          # MCP protocol client
│   │   ├── httpClient.jsx         # HTTP utilities
│   │   ├── mathProcessor.jsx      # MathJax integration
│   │   └── constants.jsx          # App constants
│   └── lib/
│       └── utils.js               # Helper functions
├── docs/                          # Production build output
├── index.html                     # HTML entry point
├── vite.config.js                 # Vite configuration
├── package.json                   # Dependencies and scripts
└── README.md                      # This file
```

## Usage

### Basic Usage

The `LLMChatInterface` component can be used standalone or integrated into larger applications:

```jsx
import LLMChatInterface from './LLMChatInterface.jsx';

function App() {
  return (
    <LLMChatInterface
      defaultModel="openai/gpt-4o-mini"
      height="100vh"
    />
  );
}
```

### Component Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `apiKey` | string | null | OpenRouter API key (uses localStorage if not provided) |
| `defaultModel` | string | "openai/gpt-4o-mini" | Default model to use |
| `systemPrompt` | string | "" | System prompt for the conversation |
| `tools` | array | null | Tool definitions (OpenAI format) |
| `toolHandlers` | object | null | Tool implementation functions |
| `enableTools` | boolean | false | Enable tool calling |
| `toolChoice` | string | "auto" | Tool choice strategy |
| `parallelToolCalls` | boolean | true | Allow parallel tool execution |
| `onToolCall` | function | null | Callback for tool execution |
| `customModels` | array | null | Custom model list (overrides OpenRouter) |
| `className` | string | "" | Additional CSS classes |
| `height` | string | "600px" | Component height |
| `showHeader` | boolean | true | Show header section |
| `showModelSelector` | boolean | true | Show model selector |
| `showClearButton` | boolean | true | Show clear messages button |
| `showDisplayModeToggle` | boolean | true | Show markdown/text toggle |
| `onMessage` | function | null | Callback for new messages |
| `onError` | function | null | Callback for errors |
| `theme` | string | "light" | UI theme |
| `sidebarPosition` | string | "right" | Sidebar position ("left" or "right") |

### Tool Calling Example

```jsx
const tools = [
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get current weather for a location",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "City name"
          }
        },
        required: ["location"]
      }
    }
  }
];

const toolHandlers = {
  get_weather: ({ location }) => {
    // Your implementation
    return { temperature: 72, condition: "sunny" };
  }
};

<LLMChatInterface
  tools={tools}
  toolHandlers={toolHandlers}
  enableTools={true}
  onToolCall={(name, args, result, error) => {
    console.log(`Tool ${name} executed:`, result);
  }}
/>
```

### MCP Server Integration

The interface supports the Model Context Protocol for remote tool servers:

1. **Start an MCP server** (Python example provided in `mcp_server.py`):
   ```bash
   python mcp_server.py
   ```

2. **Configure in the UI**:
   - Enter MCP server URL in the sidebar
   - Select transport type (SSE or HTTP)
   - Click "Connect to MCP"
   - Available remote tools will be loaded automatically

## API Configuration

### OpenRouter API Key

Get your API key from [OpenRouter](https://openrouter.ai/):

1. Sign up at openrouter.ai
2. Generate an API key
3. Enter it in the sidebar (stored in localStorage)

### Supported Models

The interface fetches available models from OpenRouter automatically, including:
- OpenAI (GPT-4, GPT-3.5)
- Anthropic (Claude 3.5, Claude 3)
- Google (Gemini Pro)
- Meta (Llama models)
- And many more

## Development

### Tech Stack

- **React 19.2.1** - UI framework
- **Vite 7** - Build tool and dev server
- **Tailwind CSS 4.0** - Utility-first CSS
- **Radix UI** - Accessible component primitives
- **MathJax 3** - Math typesetting
- **Markdown-it** - Markdown rendering

### Architecture

The application uses a custom hooks architecture for state management:

- **`useChatEngine`** - Core chat logic, message management, API integration
- **`useModelManager`** - Model fetching and selection
- **`useMarkdownRenderer`** - Markdown and math rendering
- **`useToolManager`** - Local tool execution with error handling
- **`useMCPManager`** - MCP protocol and remote tool management
- **`useStreamingEngine`** - Streaming response handling

### Key Features

**Streaming Responses**
- Server-Sent Events (SSE) for real-time updates
- Throttled updates to prevent UI overload
- Automatic fallback to non-streaming mode

**Tool Execution**
- Parallel and sequential tool calling
- Error handling and validation
- Support for both local and remote (MCP) tools
- Tool execution logging and debugging

**Math Rendering**
- Inline math with `$...$`
- Display math with `$$...$$`
- Automatic MathJax typesetting after render

## Deployment

### GitHub Pages

The project is configured to build to the `/docs` directory for easy GitHub Pages deployment:

1. Build the project:
   ```bash
   npm run build
   ```

2. Commit the `/docs` directory:
   ```bash
   git add docs/
   git commit -m "Build for deployment"
   git push
   ```

3. Enable GitHub Pages in repository settings:
   - Source: Deploy from a branch
   - Branch: main
   - Folder: /docs

### Other Hosting Platforms

The built files in `/docs` can be deployed to:
- Netlify
- Vercel
- Cloudflare Pages
- Any static hosting service

## MCP Server (Optional)

A Python MCP server example is included (`mcp_server.py`) with:
- SSE and HTTP transport support
- Example calculator tool
- CORS configuration for browser access

```bash
# SSE transport (default)
python mcp_server.py

# HTTP transport
python mcp_server.py --transport http

# Custom port
python mcp_server.py --port 5001
```

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with `npm run dev`
5. Build with `npm run build`
6. Submit a pull request

## License

MIT License - see LICENSE file for details

## Troubleshooting

### API Key Issues
- Ensure your OpenRouter API key is valid
- Check that it's properly saved in localStorage
- Try refreshing the page

### Tool Calling Issues
- Verify tool definitions match OpenAI format
- Check that tool handlers are properly implemented
- Enable console logging to debug tool execution

### MCP Connection Issues
- Verify MCP server is running
- Check URL and port are correct
- Ensure CORS is properly configured on the server
- Try both SSE and HTTP transports

### Math Rendering Issues
- MathJax loads asynchronously - wait for page load
- Check browser console for MathJax errors
- Ensure proper LaTeX syntax in messages

## Acknowledgments

- Built with [React](https://react.dev/)
- Powered by [OpenRouter](https://openrouter.ai/)
- UI components from [Radix UI](https://www.radix-ui.com/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
- Math rendering by [MathJax](https://www.mathjax.org/)
