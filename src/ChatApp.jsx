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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, RotateCcw, Settings, ExternalLink } from 'lucide-react';
import { useOpenRouterChat } from '@/hooks/useOpenRouterChat';
import { useModelManager } from '@/hooks/useModelManager';
import useMCPManager from '@/hooks/useMCPManager';
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

// Suggested prompts for quick testing
  const SUGGESTED_PROMPTS = [
    'Can you describe your tools to me',
    'Can you select Macy\'s 2023?',
    'Tell me what company and year is selected',
    'Can you describe the tables in the Dolt DB with db_string calvinw/BusMgmtBenchmarks/main',
    'Can you fetch the financials from the Dolt db for the currently selected company?',
    'Using the calvinw/BusMgmtBenchmarks/main database fetch the financials for the currently selected company',
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

  // Local tools array
  const localTools = [addNumbersTool, getSelectedCompanyTool, setSelectedCompanyTool];

  // MCP Manager for remote tool servers
  const {
    mcpServerUrl,
    setMcpServerUrl,
    mcpConnectionStatus,
    mcpTools,
    mcpToolHandlers,
  } = useMCPManager();

  // Merge local tools with MCP tools
  const mergedTools = [...localTools, ...mcpTools];
  const mergedToolHandlers = { ...toolHandlers, ...mcpToolHandlers };

  // Use the OpenRouter chat hook with welcome message and merged tools
  const { messages, status, sendMessage, clearMessages, isLoading } = useOpenRouterChat(
    [],
    mergedTools,
    mergedToolHandlers
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
  const mcpStatusClassName = mcpConnectionStatus === 'connected'
    ? 'border-green-600 text-green-600'
    : mcpConnectionStatus === 'error'
    ? 'border-red-600 text-red-600'
    : 'border-yellow-600 text-yellow-600';
  const apiKeyStatusClassName = apiKey ? 'border-green-600 text-green-600' : 'border-red-600 text-red-600';
  const mcpStatusLabel = mcpConnectionStatus ?? 'not connected';
  const mcpBadgeClassName = mcpConnectionStatus ? mcpStatusClassName : 'border-red-600 text-red-600';
  const iframeStatusClassName = iframeSrc ? 'border-green-600 text-green-600' : 'border-red-600 text-red-600';

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
                      <CardDescription className="text-xs">
                        Get your API key from{' '}
                        <Button variant="link" asChild className="h-auto p-0 text-xs">
                          <a
                            href="https://openrouter.ai/keys"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            openrouter.ai
                          </a>
                        </Button>
                      </CardDescription>
                      {apiKey && (
                        <Badge variant="outline" className="w-fit border-green-600 text-green-600">
                          API key set
                        </Badge>
                      )}
                    </div>

                    {/* Model Selector */}
                    <div className="space-y-2">
                      <Label htmlFor="model">Model</Label>
                      {modelsLoading ? (
                        <CardDescription className="text-xs">Loading models...</CardDescription>
                      ) : (
                        <>
                          <Select value={selectedModel} onValueChange={handleSaveModel}>
                            <SelectTrigger id="model">
                              <SelectValue placeholder="Select a model" />
                            </SelectTrigger>
                            <SelectContent
                              position="popper"
                              avoidCollisions
                              className="max-h-[70vh]"
                            >
                              {models.map(model => (
                                <SelectItem key={model.id} value={model.id}>
                                  {model.id}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <CardDescription className="text-xs">
                            {models.length} models available • Selected: {selectedModelName}
                          </CardDescription>
                        </>
                      )}
                    </div>

                    {/* MCP Server URL Input */}
                    <div className="space-y-2">
                      <Label htmlFor="mcp-url" className="flex items-center gap-2">
                        MCP Server URL
                        {mcpConnectionStatus && (
                          <Badge variant="outline" className={mcpStatusClassName}>
                            {mcpConnectionStatus}
                          </Badge>
                        )}
                      </Label>
                      <Input
                        id="mcp-url"
                        type="url"
                        value={mcpServerUrl}
                        onChange={(e) => setMcpServerUrl(e.target.value)}
                        placeholder="http://localhost:8001/sse"
                      />
                      <CardDescription className="text-xs">
                        Connect to an MCP server to add remote tools.
                      </CardDescription>
                      {mcpTools.length > 0 && (
                        <Badge variant="outline" className="w-fit border-green-600 text-green-600">
                          {mcpTools.length} tool(s) loaded: {mcpTools.map(t => t.function.name).join(', ')}
                        </Badge>
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
                      <CardDescription className="text-xs">
                        URL to load in the left side panel. Must be same-origin for DOM access.
                        Leave empty to hide the panel.
                      </CardDescription>
                    </div>

                    {/* Info Box */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-xs">Current Configuration</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-xs text-muted-foreground">
                        <div className="flex items-center justify-between gap-3">
                          <span>API Key</span>
                          <Badge variant="outline" className={apiKeyStatusClassName}>
                            {apiKey ? 'Set' : 'Not set'}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>Model</span>
                          <Badge variant="secondary">{selectedModelName}</Badge>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>MCP Server</span>
                          <Badge variant="outline" className={mcpBadgeClassName}>
                            {mcpStatusLabel}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>Iframe App</span>
                          <Badge variant="outline" className={iframeStatusClassName}>
                            {iframeSrc ? 'Enabled' : 'Hidden'}
                          </Badge>
                        </div>
                        {mcpConnectionStatus === 'connected' && (
                          <CardDescription className="text-xs">
                            {mcpTools.length} tool(s) available.
                          </CardDescription>
                        )}
                      </CardContent>
                    </Card>
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
