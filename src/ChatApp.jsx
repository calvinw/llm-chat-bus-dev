import { useState, useRef, useCallback } from 'react';
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
import { MessageSquare, RotateCcw, Settings, ExternalLink, Download, FileDown } from 'lucide-react';
import { useOpenRouterChat } from '@/hooks/useOpenRouterChat';
import { useModelManager } from '@/hooks/useModelManager';
import useMCPManager from '@/hooks/useMCPManager';
import { SYSTEM_PROMPT } from '@/utils/systemPrompt';
import { exportConversationAsMarkdown, downloadMarkdown } from '@/utils/exportMarkdown';
import {
  Panel,
  Group,
  Separator,
} from 'react-resizable-panels';

const BRIDGE_REQUEST_TYPE = 'busmgmt.bridge.request';
const BRIDGE_RESPONSE_TYPE = 'busmgmt.bridge.response';
const DEFAULT_DEV_IFRAME_SRC = import.meta.env.VITE_IFRAME_SRC_DEV || 'http://localhost:3000/company_to_company.html';
const DEFAULT_PROD_IFRAME_SRC = import.meta.env.VITE_IFRAME_SRC_PROD || './busmgmt/company_to_company.html';
const DEFAULT_IFRAME_SRC = import.meta.env.VITE_IFRAME_SRC || (import.meta.env.DEV ? DEFAULT_DEV_IFRAME_SRC : DEFAULT_PROD_IFRAME_SRC);

function normalizePathname(pathname) {
  if (!pathname) return '/';
  return pathname.endsWith('/') ? pathname.slice(0, -1) || '/' : pathname;
}

function resolveIframeSource(candidate) {
  const raw = (candidate ?? '').trim();
  if (!raw) {
    return { src: '', warning: '' };
  }

  try {
    const current = new URL(window.location.href);
    const target = new URL(raw, current.href);
    const currentPath = normalizePathname(current.pathname);
    const targetPath = normalizePathname(target.pathname);
    const sameOrigin = current.origin === target.origin;
    const isRecursive = sameOrigin && currentPath === targetPath;

    if (isRecursive) {
      return {
        src: DEFAULT_IFRAME_SRC,
        warning: `Detected recursive iframe URL and reset it to ${DEFAULT_IFRAME_SRC}.`
      };
    }

    return { src: raw, warning: '' };
  } catch {
    return { src: raw, warning: 'Iframe URL could not be parsed. Please verify the value.' };
  }
}

/**
 * Example tool definition for adding two numbers (commented out)
 * Uncomment to add this as a local tool
 */
// const addNumbersTool = {
//   type: "function",
//   function: {
//     name: "add_numbers",
//     description: "Add two numbers together and return the result. Supports decimal numbers.",
//     parameters: {
//       type: "object",
//       properties: {
//         a: {
//           type: "number",
//           description: "The first number"
//         },
//         b: {
//           type: "number",
//           description: "The second number"
//         }
//       },
//       required: ["a", "b"]
//     }
//   }
// };

/**
 * Tool definition for getting selected companies and years
 */
const getSelectedCompanyTool = {
  type: "function",
  function: {
    name: "get_selected_company",
    description: "Get the current company and year selections from the financial comparison iframe. Returns company1, year1, company2, and year2 for the two companies being compared.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  }
};

/**
 * Tool definition for setting selected companies and years
 */
const setSelectedCompanyTool = {
  type: "function",
  function: {
    name: "set_selected_company",
    description: "Set the company and/or year dropdown selections in the financial comparison iframe. You can set company1/year1 for the first company and company2/year2 for the second company. Valid years: 2018-2024. Companies are loaded from the database (common ones: Amazon, Costco, Walmart, Macy's, Target, etc.).",
    parameters: {
      type: "object",
      properties: {
        company1: {
          type: "string",
          description: "The first company to compare"
        },
        year1: {
          type: "string",
          description: "The year for the first company (2018-2024)"
        },
        company2: {
          type: "string",
          description: "The second company to compare"
        },
        year2: {
          type: "string",
          description: "The year for the second company (2018-2024)"
        }
      },
      required: []
    }
  }
};

/**
 * Tool definition for getting displayed financial data
 */
const getFinancialDataTool = {
  type: "function",
  function: {
    name: "get_financial_data",
    description: "Get the financial data currently displayed in the comparison table. Returns financial numbers (revenue, costs, assets) and financial indicators (ratios, percentages) for both companies. Call once to retrieve the data.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  }
};

/**
 * Example tool handler implementation (commented out)
 * Uncomment along with addNumbersTool to enable
 */
// const addNumbersHandler = ({ a, b }) => {
//   const result = a + b;
//   return {
//     summary: `${a} + ${b} = ${result}`,
//     a: a,
//     b: b,
//     result: result
//   };
// };

// Suggested prompts for quick testing
  const SUGGESTED_PROMPTS = [
    'Can you do a ROA breakdown for these companies?',
    'Can you help me compare the two companies shown',
    'Can you explain the tradeoffs between high margin/low turn and low margin/high turn approaches for businesses',
  ];


export default function ChatApp() {
  const initialIframeConfig = resolveIframeSource(
    localStorage.getItem('chatapp_iframe_src') || DEFAULT_IFRAME_SRC
  );

  // Settings state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState(localStorage.getItem('openrouter_api_key') || '');
  const [iframeConfigWarning, setIframeConfigWarning] = useState(initialIframeConfig.warning);

  // Iframe panel state
  const [iframeSrc, setIframeSrc] = useState(initialIframeConfig.src);
  const iframeRef = useRef(null);

  const applyIframeSource = useCallback((candidate) => {
    const { src, warning } = resolveIframeSource(candidate);
    setIframeSrc(src);
    setIframeConfigWarning(warning);
    if (src) {
      localStorage.setItem('chatapp_iframe_src', src);
    } else {
      localStorage.removeItem('chatapp_iframe_src');
    }
  }, []);

  const shouldRenderIframe = Boolean(iframeSrc);

  const getIframeTargetOrigin = useCallback(() => {
    try {
      const frameUrl = new URL(iframeSrc, window.location.href);
      return frameUrl.origin;
    } catch (error) {
      console.warn('Failed to parse iframe URL, falling back to current origin', error);
      return window.location.origin;
    }
  }, [iframeSrc]);

  const requestIframeBridge = useCallback((action, payload = {}, timeoutMs = 6000) => {
    return new Promise((resolve, reject) => {
      const iframeWindow = iframeRef.current?.contentWindow;
      if (!iframeWindow || !iframeSrc) {
        reject(new Error('Iframe not loaded'));
        return;
      }

      const requestId = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `bridge-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const targetOrigin = getIframeTargetOrigin();

      let timeoutId;
      const onMessage = (event) => {
        if (event.origin !== targetOrigin || event.source !== iframeWindow) {
          return;
        }
        const message = event.data;
        if (
          !message ||
          message.type !== BRIDGE_RESPONSE_TYPE ||
          message.requestId !== requestId ||
          message.action !== action
        ) {
          return;
        }

        window.removeEventListener('message', onMessage);
        clearTimeout(timeoutId);
        if (!message.success) {
          reject(new Error(message.error || `Bridge action failed: ${action}`));
          return;
        }
        resolve(message.result);
      };

      window.addEventListener('message', onMessage);
      timeoutId = window.setTimeout(() => {
        window.removeEventListener('message', onMessage);
        reject(new Error(`Bridge timeout for action: ${action}`));
      }, timeoutMs);

      iframeWindow.postMessage(
        {
          type: BRIDGE_REQUEST_TYPE,
          requestId,
          action,
          payload
        },
        targetOrigin
      );
    });
  }, [getIframeTargetOrigin, iframeSrc]);

  // Iframe bridge - provides access to the iframe DOM
  const getIframeState = useCallback(() => {
    if (!iframeRef.current || !iframeSrc) return null;

    try {
      const doc = iframeRef.current.contentWindow?.document;
      if (!doc) return null;

      // Get dropdown values - supports both single company (sample-dropdown) and comparison (company-to-company)
      const company1Select = doc.querySelector('#company1-select');
      const year1Select = doc.querySelector('#year1-select');
      const company2Select = doc.querySelector('#company2-select');
      const year2Select = doc.querySelector('#year2-select');

      // Check if it's the comparison app (has company1/company2 selects)
      if (company1Select) {
        return {
          company1: company1Select?.value || '',
          year1: year1Select?.value || '',
          company2: company2Select?.value || '',
          year2: year2Select?.value || '',
          title: doc.title,
          url: iframeRef.current.contentWindow?.location?.href,
        };
      }

      // Fallback to single company selects (legacy sample-dropdown.html)
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

      // Check if it's the comparison app (has company1/company2 selects)
      const isComparisonApp = doc.querySelector('#company1-select') !== null;

      if (isComparisonApp) {
        // Comparison app with two companies
        if (config.company1) setSelectValue('#company1-select', config.company1);
        if (config.year1) setSelectValue('#year1-select', config.year1);
        if (config.company2) setSelectValue('#company2-select', config.company2);
        if (config.year2) setSelectValue('#year2-select', config.year2);
      } else {
        // Legacy single company app
        if (config.company) setSelectValue('#company-select', config.company);
        if (config.year) setSelectValue('#year-select', config.year);
      }

      return true;
    } catch (e) {
      console.error('Error setting iframe state:', e);
      return false;
    }
  }, [iframeSrc]);

  // Tool handlers (add add_numbers handler here if uncommenting the example tool above)
  const toolHandlers = {
    // add_numbers: ({ a, b }) => {
    //   const result = a + b;
    //   return {
    //     summary: `${a} + ${b} = ${result}`,
    //     a: a,
    //     b: b,
    //     result: result
    //   };
    // },
    get_selected_company: async () => {
      try {
        const state = await requestIframeBridge('get_selection');
        return {
          summary: `Comparing ${state.company1} (${state.year1}) vs ${state.company2} (${state.year2})`,
          company1: state.company1 || 'Not selected',
          year1: state.year1 || 'Not selected',
          company2: state.company2 || 'Not selected',
          year2: state.year2 || 'Not selected'
        };
      } catch (bridgeError) {
        console.warn('Bridge get_selection failed, attempting DOM fallback', bridgeError);
      }

      const state = getIframeState();
      if (!state) {
        return { error: 'Iframe not loaded or not accessible' };
      }

      // Check if it's the comparison app (has company1/company2)
      if (state.company1 !== undefined) {
        return {
          summary: `Comparing ${state.company1} (${state.year1}) vs ${state.company2} (${state.year2})`,
          company1: state.company1 || 'Not selected',
          year1: state.year1 || 'Not selected',
          company2: state.company2 || 'Not selected',
          year2: state.year2 || 'Not selected',
          title: state.title
        };
      }

      // Legacy single company format
      return {
        company: state.company || 'Not selected',
        year: state.year || 'Not selected',
        title: state.title
      };
    },
    set_selected_company: async ({ company, year, company1, year1, company2, year2 }) => {
      // Build config object supporting both old and new format
      const config = {};
      if (company1) config.company1 = company1;
      if (year1) config.year1 = year1;
      if (company2) config.company2 = company2;
      if (year2) config.year2 = year2;
      // Legacy support
      if (company) config.company = company;
      if (year) config.year = year;

      try {
        const bridgePayload = {
          company1: config.company1 ?? config.company,
          year1: config.year1 ?? config.year,
          company2: config.company2,
          year2: config.year2,
        };
        const bridgeResult = await requestIframeBridge('set_selection', bridgePayload);
        return {
          success: true,
          summary: 'Updated iframe selection via bridge',
          ...bridgeResult
        };
      } catch (bridgeError) {
        console.warn('Bridge set_selection failed, attempting DOM fallback', bridgeError);
      }

      const success = setIframeState(config);
      if (!success) {
        return { error: 'Failed to set iframe state. Iframe may not be loaded.' };
      }

      // Return appropriate response based on what was set
      if (company1 || company2) {
        return {
          success: true,
          summary: `Set comparison: ${company1 || 'unchanged'} (${year1 || 'unchanged'}) vs ${company2 || 'unchanged'} (${year2 || 'unchanged'})`,
          company1: company1 || 'unchanged',
          year1: year1 || 'unchanged',
          company2: company2 || 'unchanged',
          year2: year2 || 'unchanged'
        };
      }

      return {
        success: true,
        company: company || 'unchanged',
        year: year || 'unchanged'
      };
    },
    get_financial_data: async () => {
      try {
        const data = await requestIframeBridge('get_financial_data');
        return {
          summary: `Financial data for ${data.company1} vs ${data.company2}`,
          ...data
        };
      } catch (bridgeError) {
        console.warn('Bridge get_financial_data failed, attempting DOM fallback', bridgeError);
      }
      if (!iframeRef.current || !iframeSrc) {
        return { error: 'Iframe not loaded or not accessible' };
      }

      try {
        const doc = iframeRef.current.contentWindow?.document;
        if (!doc) {
          return { error: 'Cannot access iframe document' };
        }
        const header1 = doc.getElementById('header1');
        const header2 = doc.getElementById('header2');
        const company1Header = header1?.textContent || 'Company 1';
        const company2Header = header2?.textContent || 'Company 2';
        const tableBody = doc.getElementById('table-body');
        if (!tableBody) {
          return { error: 'Financial data table not found' };
        }
        const rows = tableBody.querySelectorAll('tr');
        const financialNumbers = {};
        const financialIndicators = {};
        let currentSection = null;

        rows.forEach(row => {
          if (row.classList.contains('section-header')) {
            const sectionText = row.textContent.trim();
            if (sectionText.includes('Financial Numbers')) {
              currentSection = 'numbers';
            } else if (sectionText.includes('Financial Indicators')) {
              currentSection = 'indicators';
            }
            return;
          }
          if (row.classList.contains('metric-row')) {
            const cells = row.querySelectorAll('td');
            if (cells.length === 3) {
              const metricName = cells[0].textContent.trim();
              const value1 = cells[1].textContent.trim();
              const value2 = cells[2].textContent.trim();

              const metricData = {
                [company1Header]: value1,
                [company2Header]: value2
              };

              if (currentSection === 'numbers') {
                financialNumbers[metricName] = metricData;
              } else if (currentSection === 'indicators') {
                financialIndicators[metricName] = metricData;
              }
            }
          }
        });
        if (Object.keys(financialNumbers).length === 0 && Object.keys(financialIndicators).length === 0) {
          return {
            error: 'No financial data available. Please select companies to compare.',
            company1: company1Header,
            company2: company2Header
          };
        }

        return {
          summary: `Financial data for ${company1Header} vs ${company2Header}`,
          company1: company1Header,
          company2: company2Header,
          financial_numbers: financialNumbers,
          financial_indicators: financialIndicators,
          note: 'All values are displayed exactly as shown to the user with rounding applied. Financial numbers are in thousands of dollars.'
        };
      } catch (e) {
        console.error('Error extracting financial data:', e);
        return { error: `Failed to extract financial data: ${e.message}` };
      }
    }
  };

  // Local tools array (add addNumbersTool here if uncommenting the example above)
  const localTools = [getSelectedCompanyTool, setSelectedCompanyTool, getFinancialDataTool];

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
    await sendMessage(message.text, { model: selectedModel, systemPrompt: SYSTEM_PROMPT });
  };

  // Handle suggested prompt click
  const handleSuggestedPrompt = async (prompt) => {
    await sendMessage(prompt, { model: selectedModel, systemPrompt: SYSTEM_PROMPT });
  };

  // Clear conversation
  const handleClearConversation = () => {
    clearMessages();
  };

  // Export conversation as markdown (detailed)
  const handleExportConversation = () => {
    const md = exportConversationAsMarkdown(messages);
    const timestamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');
    downloadMarkdown(md, `conversation-${timestamp}.md`);
  };

  // Export conversation as markdown (compact — no tool details)
  const handleExportCompact = () => {
    const md = exportConversationAsMarkdown(messages, { compact: true });
    const timestamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');
    downloadMarkdown(md, `conversation-compact-${timestamp}.md`);
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
  const iframeStatusClassName = shouldRenderIframe ? 'border-green-600 text-green-600' : 'border-red-600 text-red-600';

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
        <Panel defaultSize={shouldRenderIframe ? 50 : 0} minSize={shouldRenderIframe ? 20 : 0}>
          {shouldRenderIframe && (
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
        <Panel defaultSize={shouldRenderIframe ? 50 : 100} minSize={20}>
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
                <SheetContent side="right" className="w-80 overflow-y-auto">
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
                          applyIframeSource(e.target.value);
                        }}
                        placeholder={DEFAULT_IFRAME_SRC}
                      />
                      <CardDescription className="text-xs">
                        URL to load in the left side panel. Bridge messaging works across origins; direct DOM fallback requires same-origin.
                        Leave empty to hide the panel.
                      </CardDescription>
                      {iframeConfigWarning && (
                        <CardDescription className="text-xs text-red-600">
                          {iframeConfigWarning}
                        </CardDescription>
                      )}
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
                            {shouldRenderIframe ? 'Enabled' : 'Hidden'}
                          </Badge>
                        </div>
                        {mcpConnectionStatus === 'connected' && (
                          <CardDescription className="text-xs">
                            {mcpTools.length} tool(s) available.
                          </CardDescription>
                        )}
                      </CardContent>
                    </Card>

                    {/* Export Conversation */}
                    <div className="space-y-2">
                      <Label>Export Conversation</Label>
                      <div className="flex flex-col gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleExportCompact}
                          disabled={messages.length === 0}
                          className="justify-start"
                        >
                          <FileDown className="size-4 mr-2" />
                          Save Chat
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleExportConversation}
                          disabled={messages.length === 0}
                          className="justify-start"
                        >
                          <Download className="size-4 mr-2" />
                          Save Full
                        </Button>
                      </div>
                    </div>

                    {/* System Prompt */}
                    <div className="space-y-2">
                      <Label>System Prompt</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="justify-start w-full"
                      >
                        <a
                          href="./system-prompt.html"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="size-4 mr-2" />
                          View System Prompt
                        </a>
                      </Button>
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
                    <div className="max-w-lg space-y-4">
                      <MessageSquare className="mx-auto size-12 text-muted-foreground" />
                      <h2 className="text-lg font-semibold">Start a conversation</h2>
                      <p className="text-sm text-muted-foreground">
                        Ask about financial analysis, ROA breakdown, or company comparisons
                      </p>
                      <div className="flex flex-col gap-2 pt-2">
                        {SUGGESTED_PROMPTS.map((prompt, index) => (
                          <button
                            key={index}
                            onClick={() => handleSuggestedPrompt(prompt)}
                            className="text-sm px-4 py-2.5 rounded-lg bg-muted hover:bg-muted-foreground/10 text-muted-foreground transition-colors border text-left"
                            disabled={isLoading}
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
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
          <div className="border-t p-4">
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
          </div>
        </div>
      </Panel>
      </Group>
    </div>
  );
}
