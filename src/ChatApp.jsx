import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import {
  Message,
  MessageContent,
  MessageResponse,
} from '@/components/ai-elements/message';
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputTools,
  PromptInputTextarea,
  PromptInputSubmit,
} from '@/components/ai-elements/prompt-input';
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from '@/components/ai-elements/tool';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MessageSquare, RotateCcw, Settings, ExternalLink } from 'lucide-react';
import { useOpenRouterChat } from '@/hooks/useOpenRouterChat';
import { useModelManager } from '@/hooks/useModelManager';
import {
  Panel,
  Group,
  Separator,
} from 'react-resizable-panels';

/**
 * Tool definition for adding two numbers
 */
const addNumbersTool = {
  type: "function",
  function: {
    name: "add_numbers",
    description: "Add two numbers together and return the result. Supports decimal numbers.",
    parameters: {
      type: "object",
      properties: {
        a: {
          type: "number",
          description: "The first number"
        },
        b: {
          type: "number",
          description: "The second number"
        }
      },
      required: ["a", "b"]
    }
  }
};

/**
 * Tool definition for getting selected company and year
 */
const getSelectedCompanyTool = {
  type: "function",
  function: {
    name: "get_selected_company",
    description: "Get the current company and year selections from the iframe app dropdowns. Returns both the selected company and year values.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  }
};

/**
 * Tool definition for setting selected company and year
 */
const setSelectedCompanyTool = {
  type: "function",
  function: {
    name: "set_selected_company",
    description: "Set the company and/or year dropdown selections in the iframe app. Valid companies: Amazon, Costco, Walmart, Macy's. Valid years: 2018-2024.",
    parameters: {
      type: "object",
      properties: {
        company: {
          type: "string",
          description: "The company to select (Amazon, Costco, Walmart, or Macy's)"
        },
        year: {
          type: "string",
          description: "The year to select (2018-2024)"
        }
      },
      required: []
    }
  }
};

/**
 * Tool handler implementation
 */
const addNumbersHandler = ({ a, b }) => {
  const result = a + b;
  return {
    summary: `${a} + ${b} = ${result}`,
    a: a,
    b: b,
    result: result
  };
};

// Welcome message
const WELCOME_MESSAGE = {
  role: 'assistant',
  content: `# Welcome to FIT Retail Index Chat! 🎉

This is a powerful AI chat interface built with **shadcn AI Elements** and **OpenRouter**.

## Getting Started

1. **Enter your API Key** - Click the **Settings** button and enter your OpenRouter API key
2. **Select a Model** - Choose from available models like GPT-4o, Claude 3.5 Sonnet, etc.
3. **Start Chatting** - Type your message below and press Enter

## Features

- ✨ **Streaming Responses** - Watch responses appear in real-time
- 🎨 **Rich Markdown** - Beautiful rendering with code highlighting, tables, and math
- 🔧 **Multiple Models** - Switch between GPT-4o, Claude, Gemini, and more
- 🔨 **Tool Support** - Try asking "What is 123.45 + 67.89?"
- 💾 **Persistent Settings** - Your API key and model are saved automatically

---

Ready to chat? Enter your API key in settings and send a message! 🚀`
};

// Suggested prompts for quick testing
const SUGGESTED_PROMPTS = [
  'Show me examples of markdown rendering with code blocks, math expressions, lists, tables, and other formatting.',
  'Can you explain conjoint analysis using math notation',
  'Can you give me 5 example SQL scripts',
  'What is 123.45 + 67.89?',
  'Can you describe your tools to me',
];

export default function ChatApp() {
  // Settings state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState(localStorage.getItem('openrouter_api_key') || '');

  // Iframe panel state
  const [iframeSrc, setIframeSrc] = useState(() => {
    return localStorage.getItem('chatapp_iframe_src') || './sample-dropdown.html';
  });
  const iframeRef = useRef(null);

  // Iframe bridge - provides access to the iframe DOM
  const getIframeState = useCallback(() => {
    if (!iframeRef.current || !iframeSrc) return null;

    try {
      const doc = iframeRef.current.contentWindow?.document;
      if (!doc) return null;

      // Get dropdown values from sample page
      const companySelect = doc.querySelector('#company-select');
      const yearSelect = doc.querySelector('#year-select');

      return {
        company: companySelect?.value || '',
        year: yearSelect?.value || '',
        title: doc.title,
        url: iframeRef.current.contentWindow?.location?.href,
      };
    } catch (e) {
      console.error('Error accessing iframe:', e);
      return null;
    }
  }, [iframeSrc]);

  const setIframeState = useCallback((config) => {
    if (!iframeRef.current || !iframeSrc) return false;

    try {
      const doc = iframeRef.current.contentWindow?.document;
      if (!doc) return false;

      const setSelectValue = (selector, value) => {
        const el = doc.querySelector(selector);
        if (el) {
          const optionExists = Array.from(el.options).some(opt => opt.value === value);
          if (optionExists) {
            el.value = value;
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
        }
        return false;
      };

      if (config.company) setSelectValue('#company-select', config.company);
      if (config.year) setSelectValue('#year-select', config.year);

      return true;
    } catch (e) {
      console.error('Error setting iframe state:', e);
      return false;
    }
  }, [iframeSrc]);

  // Tool handlers
  const toolHandlers = {
    add_numbers: ({ a, b }) => {
      const result = a + b;
      return {
        summary: `${a} + ${b} = ${result}`,
        a: a,
        b: b,
        result: result
      };
    },
    get_selected_company: () => {
      const state = getIframeState();
      if (!state) {
        return { error: 'Iframe not loaded or not accessible' };
      }
      return {
        company: state.company || 'Not selected',
        year: state.year || 'Not selected',
        title: state.title
      };
    },
    set_selected_company: ({ company, year }) => {
      const success = setIframeState({ company, year });
      if (!success) {
        return { error: 'Failed to set iframe state. Iframe may not be loaded.' };
      }
      return {
        success: true,
        company: company || 'unchanged',
        year: year || 'unchanged'
      };
    }
  };

  // Tools array
  const tools = [addNumbersTool, getSelectedCompanyTool, setSelectedCompanyTool];

  // Use the OpenRouter chat hook with welcome message and tools
  const { messages, status, sendMessage, clearMessages, isLoading } = useOpenRouterChat(
    [WELCOME_MESSAGE],
    tools,
    toolHandlers
  );

  // Fetch models from OpenRouter API
  const { models, loading: modelsLoading } = useModelManager(apiKey);

  const [selectedModel, setSelectedModel] = useState(() => {
    return localStorage.getItem('openrouter_model') || 'openai/gpt-4o-mini';
  });

  // Save API key to localStorage
  const handleSaveApiKey = (key) => {
    setApiKey(key);
    localStorage.setItem('openrouter_api_key', key);
  };

  // Save model to localStorage
  const handleSaveModel = (modelId) => {
    setSelectedModel(modelId);
    localStorage.setItem('openrouter_model', modelId);
  };

  // Handle form submission from PromptInput
  const handleSubmit = async (message) => {
    if (!message.text?.trim()) return;
    await sendMessage(message.text, { model: selectedModel });
  };

  // Handle suggested prompt click
  const handleSuggestedPrompt = async (prompt) => {
    await sendMessage(prompt, { model: selectedModel });
  };

  // Clear conversation
  const handleClearConversation = () => {
    clearMessages();
  };

  const selectedModelName = selectedModel;

  // Render tool parts if present
  const renderToolPart = (part) => {
    return (
      <Tool key={part.toolCallId} defaultOpen={part.state === 'output-error'} className="my-1">
        <ToolHeader type={part.type} state={part.state} />
        <ToolContent>
          {part.input && <ToolInput input={part.input} />}
          <ToolOutput output={part.output} errorText={part.errorText} />
        </ToolContent>
      </Tool>
    );
  };

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <Group orientation="horizontal" style={{ width: '100%', height: '100%' }}>
        {/* Iframe Panel */}
        <Panel defaultSize={iframeSrc ? 50 : 0} minSize={iframeSrc ? 20 : 0}>
          {iframeSrc && (
            <div style={{ height: '100%' }}>
              <iframe
                ref={iframeRef}
                src={iframeSrc}
                className="w-full h-full border-0"
                title="Side Panel"
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-downloads"
              />
            </div>
          )}
        </Panel>

        <Separator className="w-1 bg-border hover:bg-primary/50 transition-colors cursor-col-resize" />

        {/* Main Chat Panel */}
        <Panel defaultSize={iframeSrc ? 50 : 100} minSize={20}>
        <div style={{ height: '100%' }} className="flex flex-col">
          {/* Header */}
          <header className="flex items-center justify-between border-b px-6 py-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="size-5" />
              <h1 className="text-xl font-semibold">FIT Retail Index Chat</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearConversation}
                disabled={messages.length === 0}
              >
                <RotateCcw className="size-4 mr-2" />
                New Chat
              </Button>
              <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Settings className="size-4 mr-2" />
                    Settings
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-80">
                  <SheetHeader>
                    <SheetTitle>Settings</SheetTitle>
                  </SheetHeader>
                  <div className="space-y-6 py-6">
                    {/* API Key Input */}
                    <div className="space-y-2">
                      <Label htmlFor="api-key">OpenRouter API Key</Label>
                      <Input
                        id="api-key"
                        type="password"
                        value={apiKey}
                        onChange={(e) => handleSaveApiKey(e.target.value)}
                        placeholder="sk-or-..."
                      />
                      <p className="text-xs text-muted-foreground">
                        Get your API key from{' '}
                        <a
                          href="https://openrouter.ai/keys"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:text-foreground"
                        >
                          openrouter.ai
                        </a>
                      </p>
                      {apiKey && (
                        <p className="text-xs text-green-600 dark:text-green-400">
                          ✓ API key is set
                        </p>
                      )}
                    </div>

                    {/* Model Selector */}
                    <div className="space-y-2">
                      <Label htmlFor="model">Model</Label>
                      {modelsLoading ? (
                        <p className="text-xs text-muted-foreground">Loading models...</p>
                      ) : (
                        <>
                          <select
                            id="model"
                            value={selectedModel}
                            onChange={(e) => handleSaveModel(e.target.value)}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {models.map(model => (
                              <option key={model.id} value={model.id}>
                                {model.id}
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-muted-foreground">
                            {models.length} models available • Selected: {selectedModelName}
                          </p>
                        </>
                      )}
                    </div>

                    {/* Iframe URL Input */}
                    <div className="space-y-2">
                      <Label htmlFor="iframe-url">Iframe App URL</Label>
                      <Input
                        id="iframe-url"
                        type="text"
                        value={iframeSrc}
                        onChange={(e) => {
                          const newSrc = e.target.value;
                          setIframeSrc(newSrc);
                          localStorage.setItem('chatapp_iframe_src', newSrc);
                        }}
                        placeholder="./BusMgmtBenchmarks/company_to_company.html"
                      />
                      <p className="text-xs text-muted-foreground">
                        URL to load in the left side panel. Must be same-origin for DOM access.
                        Leave empty to hide the panel.
                      </p>
                    </div>

                    {/* Info Box */}
                    <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                      <p className="font-medium mb-1">Current Configuration:</p>
                      <ul className="space-y-1">
                        <li>• API Key: {apiKey ? '✓ Set' : '✗ Not set'}</li>
                        <li>• Model: {selectedModelName}</li>
                        <li>• Iframe App: {iframeSrc ? '✓ Enabled' : '✗ Hidden'}</li>
                      </ul>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </header>

          {/* Conversation Area */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <Conversation className="h-full">
              <ConversationContent>
                {messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-center">
                    <div className="max-w-md space-y-2">
                      <MessageSquare className="mx-auto size-12 text-muted-foreground" />
                      <h2 className="text-lg font-semibold">Start a conversation</h2>
                      <p className="text-sm text-muted-foreground">
                        Type a message below to test the UI
                      </p>
                    </div>
                  </div>
                ) : (
                  messages.map((message, index) => (
                    <Message key={index} from={message.role}>
                      <MessageContent>
                        {/* Render text content - skip for tool messages */}
                        {message.role !== 'tool' && message.content && <MessageResponse>{message.content}</MessageResponse>}

                        {/* Render tool parts - only show tool results (output or error), not assistant tool calls */}
                        {message.parts?.filter(p =>
                          p.type?.startsWith('tool-') &&
                          (p.state === 'output-available' || p.state === 'output-error')
                        ).map(renderToolPart)}
                      </MessageContent>
                    </Message>
                  ))
                )}
              </ConversationContent>
              <ConversationScrollButton />
            </Conversation>
          </div>

          {/* Input Area */}
          <div className="border-t p-4 space-y-3">
            <PromptInput onSubmit={handleSubmit}>
              <PromptInputBody>
                <PromptInputTextarea placeholder="Type your message..." />
              </PromptInputBody>
              <PromptInputFooter>
                <PromptInputTools>
                  <span className="text-sm text-muted-foreground px-2">
                    {selectedModelName}
                  </span>
                </PromptInputTools>
                <PromptInputSubmit status={status} />
              </PromptInputFooter>
            </PromptInput>

            {/* Suggested Prompts */}
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_PROMPTS.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestedPrompt(prompt)}
                  className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted-foreground/10 text-muted-foreground transition-colors border"
                  disabled={isLoading}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Panel>
      </Group>
    </div>
  );
}
