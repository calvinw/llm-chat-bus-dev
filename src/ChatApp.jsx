import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/utils/supabaseClient';
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
import { Loader } from '@/components/ai-elements/loader';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
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
import { MessageSquare, RotateCcw, Settings, ExternalLink, Download, FileDown, Printer, WrenchIcon, CheckCircleIcon, XCircleIcon, Trash2, History } from 'lucide-react';
import { useOpenRouterChat } from '@/hooks/useOpenRouterChat';
import { useConversations } from '@/hooks/useConversations';
import { useModelManager } from '@/hooks/useModelManager';
import useMCPManager from '@/hooks/useMCPManager';
import { SYSTEM_PROMPTS, DEFAULT_PROMPT_KEY, SYSTEM_PROMPT } from '@/utils/systemPrompt';
import { exportConversationAsMarkdown, downloadMarkdown } from '@/utils/exportMarkdown';
import { printConversationWithTable } from '@/utils/exportPdf';
import {
  Panel,
  Group,
  Separator,
} from 'react-resizable-panels';

const BRIDGE_REQUEST_TYPE = 'busmgmt.bridge.request';
const BRIDGE_RESPONSE_TYPE = 'busmgmt.bridge.response';
// In GitHub Codespaces, the browser can't reach localhost:3000 — it must use the
// forwarded URL (e.g. https://[name]-3000.app.github.dev). Detect this by checking
// if the current hostname matches the Codespaces pattern and swap the port.
function getDevIframeSrc() {
  if (import.meta.env.VITE_IFRAME_SRC_DEV) return import.meta.env.VITE_IFRAME_SRC_DEV;
  const { hostname } = window.location;
  if (hostname.endsWith('.app.github.dev')) {
    const host3000 = hostname.replace(/-\d+\.app\.github\.dev$/, '-3000.app.github.dev');
    return `https://${host3000}/?iframe=true`;
  }
  return 'http://localhost:3000/?iframe=true';
}

const DEFAULT_DEV_IFRAME_SRC = getDevIframeSrc();
const DEFAULT_PROD_IFRAME_SRC = import.meta.env.VITE_IFRAME_SRC_PROD || './busmgmt/?iframe=true';
const DEFAULT_IFRAME_SRC = import.meta.env.VITE_IFRAME_SRC || (import.meta.env.DEV ? DEFAULT_DEV_IFRAME_SRC : DEFAULT_PROD_IFRAME_SRC);

// If a localhost:3000 URL was saved to localStorage from a non-Codespaces session,
// it won't work in Codespaces. Translate it to the forwarded URL.
function translateStoredIframeSrc(stored) {
  if (!stored) return null;
  const { hostname } = window.location;
  if (hostname.endsWith('.app.github.dev') && /localhost:3000/.test(stored)) {
    return DEFAULT_DEV_IFRAME_SRC;
  }
  return stored;
}

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
const getSelectedCompaniesTool = {
  type: "function",
  function: {
    name: "get_selected_companies",
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
const setSelectedCompaniesTool = {
  type: "function",
  function: {
    name: "set_selected_companies",
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

// Suggested prompts per prompt mode
const SUGGESTED_PROMPTS_BY_MODE = {
  'advanced-roa': [
    'Can you do a ROA breakdown for these companies?',
    'Can you help me compare the two companies shown',
    'Can you explain the tradeoffs between high margin/low turn and low margin/high turn approaches for businesses',
  ],
  'basic-financials': [
    'Can you walk me through the financial numbers for these companies?',
    'What does gross margin mean and how is it calculated?',
    'Help me understand the difference between these two companies',
  ],
  'quiz-basic': [
    'Quiz me on the basics of the financial data shown',
    'Test my knowledge of financial terms',
    'Ask me some questions about these companies',
  ],
  'quiz-roa': [
    'Quiz me on ROA analysis for these companies',
    'Test my understanding of the Strategic Profit Model',
    'Ask me questions about margin vs turnover tradeoffs',
  ],
};


export default function ChatApp() {
  // Auth state — null means we're still checking, false means not logged in
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [provisionedKey, setProvisionedKey] = useState(null);
  const [keyLoading, setKeyLoading] = useState(false);
  const [capReached, setCapReached] = useState(false);
  const provisionedForUser = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? false);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? false);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      provisionedForUser.current = null;
      setProvisionedKey(null);
      return;
    }
    // Prevent duplicate calls within the same page load
    if (provisionedForUser.current === user.id) return;
    provisionedForUser.current = user.id;

    setKeyLoading(true);
    supabase.functions.invoke('provision-key')
      .then(({ data }) => {
        if (data?.key) {
          setProvisionedKey(data.key);
          // Set a default scenario if none has been chosen yet, so the chat input is enabled
          if (!localStorage.getItem('chatapp_prompt_mode')) {
            setPromptKey('basic-financials');
            localStorage.setItem('chatapp_prompt_mode', 'basic-financials');
          }
        }
      })
      .finally(() => setKeyLoading(false));
  }, [user]);

  const handleGoogleSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const initialIframeConfig = resolveIframeSource(
    translateStoredIframeSrc(localStorage.getItem('chatapp_iframe_src')) || DEFAULT_IFRAME_SRC
  );

  // Settings state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState(localStorage.getItem('openrouter_api_key') || '');
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [iframeConfigWarning, setIframeConfigWarning] = useState(initialIframeConfig.warning);
  const [toolDisplayMode, setToolDisplayMode] = useState(() => localStorage.getItem('chatapp_tool_display') || 'none');

  // Prompt mode state — null means no scenario chosen yet
  const [promptKey, setPromptKey] = useState(() => localStorage.getItem('chatapp_prompt_mode') || null);
  const activeSystemPrompt = promptKey ? (SYSTEM_PROMPTS[promptKey]?.prompt || SYSTEM_PROMPT) : null;
  const activeSuggestedPrompts = promptKey ? (SUGGESTED_PROMPTS_BY_MODE[promptKey] || SUGGESTED_PROMPTS_BY_MODE[DEFAULT_PROMPT_KEY]) : [];
  const scenarioChosen = promptKey !== null;

  const handlePromptModeChange = (key) => {
    setPromptKey(key);
    localStorage.setItem('chatapp_prompt_mode', key);
    clearMessages();
  };

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

  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const [mobileTopPct, setMobileTopPct] = useState(40);
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);
  const mobileContainerRef = useRef(null);

  const handleMobileDrag = useCallback((e) => {
    e.preventDefault();
    const startY = e.touches ? e.touches[0].clientY : e.clientY;
    const containerHeight = mobileContainerRef.current?.getBoundingClientRect().height ?? window.innerHeight;
    const startPct = mobileTopPct;
    setIsDraggingDivider(true);

    const onMove = (ev) => {
      ev.preventDefault();
      const currentY = ev.touches ? ev.touches[0].clientY : ev.clientY;
      const newPct = Math.min(75, Math.max(15, startPct + ((currentY - startY) / containerHeight) * 100));
      setMobileTopPct(newPct);
    };
    const onEnd = () => {
      setIsDraggingDivider(false);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);
  }, [mobileTopPct]);

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
    get_selected_companies: async () => {
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
    set_selected_companies: async ({ company, year, company1, year1, company2, year2 }) => {
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
  const localTools = [getSelectedCompaniesTool, setSelectedCompaniesTool, getFinancialDataTool];

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

  // Provisioned key takes precedence over any manually stored key
  const effectiveApiKey = provisionedKey || apiKey;

  // Use the OpenRouter chat hook with welcome message and merged tools
  const { messages, status, sendMessage, clearMessages, loadMessages, isLoading, error: chatError } = useOpenRouterChat(
    [],
    mergedTools,
    mergedToolHandlers,
    effectiveApiKey
  );

  const {
    conversations,
    currentConversationId,
    setCurrentConversationId,
    loadingHistory,
    loadConversations,
    saveConversation,
    loadConversationMessages,
  } = useConversations(user);

  const [historyOpen, setHistoryOpen] = useState(false);
  const prevStatusRef = useRef('idle');

  useEffect(() => {
    const wasActive = prevStatusRef.current === 'streaming' || prevStatusRef.current === 'executing_tools';
    prevStatusRef.current = status;
    if (wasActive && status === 'idle' && messages.length > 0) {
      saveConversation(messages, currentConversationId).then(id => {
        if (id && id !== currentConversationId) setCurrentConversationId(id);
      });
    }
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (chatError?.message?.includes('429')) setCapReached(true);
  }, [chatError]);

  // Fetch models from OpenRouter API
  const { models, loading: modelsLoading } = useModelManager(apiKey);

  const [selectedModel, setSelectedModel] = useState(() => {
    return localStorage.getItem('openrouter_model') || 'google/gemini-3-flash-preview';
  });

  // Save API key to localStorage
  const handleSaveApiKey = (key) => {
    setApiKey(key);
    localStorage.setItem('openrouter_api_key', key);
    // Default to Basic Financials scenario if no scenario has been chosen yet
    if (!promptKey) {
      setPromptKey('basic-financials');
      localStorage.setItem('chatapp_prompt_mode', 'basic-financials');
    }
  };

  // Save model to localStorage
  const handleSaveModel = (modelId) => {
    setSelectedModel(modelId);
    localStorage.setItem('openrouter_model', modelId);
  };

  // Handle form submission from PromptInput
  const handleSubmit = async (message) => {
    if (!message.text?.trim()) return;
    await sendMessage(message.text, { model: selectedModel, systemPrompt: activeSystemPrompt });
  };

  // Handle suggested prompt click
  const handleSuggestedPrompt = async (prompt) => {
    await sendMessage(prompt, { model: selectedModel, systemPrompt: activeSystemPrompt });
  };

  // Inject CSS into the iframe to hide the hamburger menu button (same-origin only — works in production)
  const handleIframeLoad = useCallback(() => {
    try {
      const doc = iframeRef.current?.contentWindow?.document;
      if (!doc) return;
      const style = doc.createElement('style');
      style.textContent = [
        'button[aria-label="Open menu"] { display: none !important; }',
        'main { padding-top: 0.25rem !important; }',
        'div:has(> button.bg-green-600) { display: none !important; }',
        '@media (max-width: 767px) {',
        '  div:has(> div > img[alt="FIT Retail Index Report"]) { display: none !important; }',
        '}',
      ].join('\n');
      doc.head.appendChild(style);
    } catch (e) {
      // Cross-origin in dev — silently ignore
    }
  }, []);

  // Clear conversation and start fresh
  const handleClearConversation = () => {
    clearMessages();
    setCurrentConversationId(null);
  };

  // Load a past conversation from history
  const handleLoadConversation = async (id) => {
    const msgs = await loadConversationMessages(id);
    if (msgs) {
      loadMessages(msgs);
      setCurrentConversationId(id);
      setHistoryOpen(false);
    }
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

  // Save as PDF via browser print dialog
  const handleSavePdf = () => {
    printConversationWithTable(iframeRef.current, messages);
  };

  // Clear all localStorage values and reload
  const handleClearAllSettings = () => {
    localStorage.clear();
    window.location.reload();
  };

  const selectedModelName = selectedModel;
  const mcpStatusClassName = mcpConnectionStatus === 'connected'
    ? 'border-green-600 text-green-600'
    : mcpConnectionStatus === 'error'
    ? 'border-red-600 text-red-600'
    : 'border-yellow-600 text-yellow-600';
  const apiKeyStatusClassName = effectiveApiKey ? 'border-green-600 text-green-600' : 'border-red-600 text-red-600';
  const mcpStatusLabel = mcpConnectionStatus ?? 'not connected';
  const mcpBadgeClassName = mcpConnectionStatus ? mcpStatusClassName : 'border-red-600 text-red-600';
  const iframeStatusClassName = shouldRenderIframe ? 'border-green-600 text-green-600' : 'border-red-600 text-red-600';

  // Render tool parts with full details
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

  // Rotating thinking messages
  const thinkingMessages = [
    'Waiting for Souyen to make the User Interface…',
    "Asking Diana's GPT for a reading…",
    "Asking Elena when she's ready to code…",
    'Waiting for Smera to get to Upper Division…',
    'Checking the final exam…',
    'Visiting Chegg…',
    'Asking students from last semester…',
    'Wait, we have a textbook?…',
    'Reviewing my Rate My Professor comments…',
    'Pretending to understand the balance sheet…',
    'Cramming before the midterm…',
    "Looking up 'accounting' on Wikipedia…",
    'Asking ChatGPT… wait…',
    'Hoping the curve saves us…',
    'Checking if the library is open…',
    'Raising my hand… never!',
    'Emailing the professor at 2 AM…',
    'Praying to the Excel gods…',
    "Copying the smart kid's spreadsheet…",
    'Watching a YouTube tutorial…',
    'Waiting for Vanyaa to commit the code…',
    "Avoiding answering the professor's email...",
    'Wait for Hee to finish her internship…',
    'Catie is waiting for holidays…',
    'Waiting for Jessie to join the chat…',
  ];

  const toolMessages = [
    'Hacking into the mainframe…',
    "Borrowing someone's Bloomberg terminal…",
    'Sneaking into the computer lab…',
    "Stealing the professor's answer key…",
    'Opening Excel for the first time…',
  ];

  const [thinkingIndex, setThinkingIndex] = useState(() => Math.floor(Math.random() * 100));
  useEffect(() => {
    if (!isLoading) {
      setThinkingIndex(Math.floor(Math.random() * 100));
      return;
    }
    const interval = setInterval(() => {
      setThinkingIndex(i => i + 1);
    }, 3000);
    return () => clearInterval(interval);
  }, [isLoading]);

  const currentThinkingMessage = status === 'executing_tools'
    ? toolMessages[thinkingIndex % toolMessages.length]
    : thinkingMessages[thinkingIndex % thinkingMessages.length];

  if (authLoading || keyLoading) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a' }}>
        <div style={{ color: '#94a3b8', fontSize: '1rem' }}>{keyLoading ? 'Setting up your account…' : 'Loading...'}</div>
      </div>
    );
  }

  if (capReached) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '2.5rem', background: '#1e293b', borderRadius: '1rem', boxShadow: '0 4px 32px rgba(0,0,0,0.4)', maxWidth: '420px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#f1f5f9' }}>Monthly Limit Reached</div>
          <div style={{ fontSize: '0.95rem', color: '#94a3b8' }}>
            You've reached your $0.50 monthly usage limit. Check back next month, or add your own OpenRouter key in Settings to keep going now.
          </div>
          <button
            onClick={() => { setCapReached(false); setApiKeyDialogOpen(true); }}
            style={{ padding: '0.6rem 1.25rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '0.5rem', fontSize: '0.95rem', fontWeight: '600', cursor: 'pointer' }}
          >
            Enter My Own Key
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', padding: '2.5rem', background: '#1e293b', borderRadius: '1rem', boxShadow: '0 4px 32px rgba(0,0,0,0.4)', minWidth: '320px' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#f1f5f9' }}>FIT Retail Index Chat</div>
          <div style={{ fontSize: '0.95rem', color: '#94a3b8', textAlign: 'center' }}>Sign in to access the financial comparison assistant.</div>
          <button
            onClick={handleGoogleSignIn}
            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1.5rem', background: '#fff', color: '#1e293b', border: 'none', borderRadius: '0.5rem', fontSize: '1rem', fontWeight: '600', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.2)', width: '100%', justifyContent: 'center' }}
          >
            <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.08 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-3.58-13.46-8.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></svg>
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  const iframeEl = shouldRenderIframe ? (
    <iframe
      ref={iframeRef}
      src={iframeSrc}
      className="w-full h-full border-0"
      title="Side Panel"
      sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-downloads"
      onLoad={handleIframeLoad}
    />
  ) : null;

  const chatContent = (
    <div style={{ height: '100%' }} className="flex flex-col">
          {/* Header */}
          <header className={`flex items-center border-b ${isMobile ? 'px-2 py-1 gap-1' : 'justify-between px-6 py-4'}`}>
            {!isMobile && (
              <div className="flex items-center gap-2">
                <MessageSquare className="size-5" />
                <h1 className="text-xl font-semibold">FIT Retail Index Chat</h1>
              </div>
            )}
            <div className={`flex items-center ${isMobile ? 'gap-1 flex-1' : 'gap-2'}`}>
              <Button
                variant="ghost"
                size={isMobile ? 'icon' : 'sm'}
                onClick={handleClearConversation}
                disabled={messages.length === 0}
              >
                <RotateCcw className="size-4" />
                {!isMobile && <span className="ml-2">New Chat</span>}
              </Button>
              <Button
                variant="ghost"
                size={isMobile ? 'icon' : 'sm'}
                onClick={handleSavePdf}
                disabled={messages.length === 0}
              >
                <Printer className="size-4" />
                {!isMobile && <span className="ml-2">Save PDF</span>}
              </Button>
              <Select value={promptKey || ''} onValueChange={handlePromptModeChange}>
                <SelectTrigger className={`h-8 gap-1 px-2 text-sm ${isMobile ? 'flex-1 min-w-0' : 'w-auto'}`}>
                  <SelectValue placeholder="Choose Scenario" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SYSTEM_PROMPTS).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Sheet open={historyOpen} onOpenChange={(open) => { setHistoryOpen(open); if (open) loadConversations(); }}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size={isMobile ? 'icon' : 'sm'}>
                    <History className="size-4" />
                    {!isMobile && <span className="ml-2">History</span>}
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-80 flex flex-col p-0">
                  <SheetHeader className="px-6 py-4 border-b">
                    <SheetTitle>Chat History</SheetTitle>
                  </SheetHeader>
                  <div className="px-4 pt-4">
                    <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => { handleClearConversation(); setHistoryOpen(false); }}>
                      <RotateCcw className="size-4 mr-2" />
                      New Chat
                    </Button>
                  </div>
                  <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                    {loadingHistory ? (
                      <p className="text-sm text-muted-foreground text-center pt-4">Loading…</p>
                    ) : conversations.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center pt-4">No saved chats yet.</p>
                    ) : (
                      (() => {
                        const now = new Date();
                        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                        const startOfYesterday = new Date(startOfToday - 86400000);
                        const startOfLastWeek = new Date(startOfToday - 7 * 86400000);
                        const groups = [
                          { label: 'Today', items: conversations.filter(c => new Date(c.updated_at) >= startOfToday) },
                          { label: 'Yesterday', items: conversations.filter(c => new Date(c.updated_at) >= startOfYesterday && new Date(c.updated_at) < startOfToday) },
                          { label: 'Last Week', items: conversations.filter(c => new Date(c.updated_at) >= startOfLastWeek && new Date(c.updated_at) < startOfYesterday) },
                          { label: 'Older', items: conversations.filter(c => new Date(c.updated_at) < startOfLastWeek) },
                        ].filter(g => g.items.length > 0);
                        return groups.map(group => (
                          <div key={group.label}>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{group.label}</p>
                            <div className="space-y-1">
                              {group.items.map(conv => (
                                <button
                                  key={conv.id}
                                  onClick={() => handleLoadConversation(conv.id)}
                                  className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors flex items-center justify-between gap-2 ${conv.id === currentConversationId ? 'bg-muted font-medium' : ''}`}
                                >
                                  <span className="truncate">{conv.title}</span>
                                  <span className="text-xs text-muted-foreground shrink-0">
                                    {new Date(conv.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        ));
                      })()
                    )}
                  </div>
                  <div className="border-t px-4 py-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="size-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold shrink-0">
                        {(user?.user_metadata?.full_name || user?.email || '?').slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-sm truncate">{user?.user_metadata?.full_name || user?.email}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleSignOut} className="shrink-0">
                      Sign out
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
              <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
                {/* Settings button hidden — uncomment to restore
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Settings className="size-4 mr-2" />
                    Settings
                  </Button>
                </SheetTrigger>
                */}
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

                    {/* Tool Display Mode */}
                    <div className="space-y-2">
                      <Label htmlFor="tool-display">Tool Display</Label>
                      <Select
                        value={toolDisplayMode}
                        onValueChange={(value) => {
                          setToolDisplayMode(value);
                          localStorage.setItem('chatapp_tool_display', value);
                        }}
                      >
                        <SelectTrigger id="tool-display">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="details">Show Tools with Details</SelectItem>
                          <SelectItem value="brief">Show Brief Tools</SelectItem>
                          <SelectItem value="none">Show No Tools</SelectItem>
                        </SelectContent>
                      </Select>
                      <CardDescription className="text-xs">
                        Controls how tool calls appear in the conversation. Tools always run regardless of this setting.
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
                          Save Chat as Markdown
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleExportConversation}
                          disabled={messages.length === 0}
                          className="justify-start"
                        >
                          <Download className="size-4 mr-2" />
                          Save Chat with Tool Details
                        </Button>
                      </div>
                    </div>

                    {/* System Prompts */}
                    <div className="space-y-2">
                      <Label>System Prompts</Label>
                      <div className="flex flex-col gap-2">
                        {Object.entries(SYSTEM_PROMPTS).map(([key, { label, file }]) => (
                          <Button
                            key={key}
                            variant="outline"
                            size="sm"
                            asChild
                            className={`justify-start w-full${key === promptKey ? ' border-primary' : ''}`}
                          >
                            <a
                              href={`./prompts/${file}.md`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="size-4 mr-2" />
                              {label}{key === promptKey ? ' (active)' : ''}
                            </a>
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Clear All Settings */}
                    <div className="space-y-2 pt-2 border-t">
                      <Label className="text-destructive">Danger Zone</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleClearAllSettings}
                        className="justify-start w-full border-destructive text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="size-4 mr-2" />
                        Clear All Settings
                      </Button>
                      <CardDescription className="text-xs">
                        Clears all saved settings (API key, model, URLs) and reloads the page.
                      </CardDescription>
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
                      {!isMobile && <MessageSquare className="mx-auto size-12 text-muted-foreground" />}
                      {scenarioChosen ? (
                        <>
                          {!isMobile && <h2 className="text-lg font-semibold">{SYSTEM_PROMPTS[promptKey]?.label}</h2>}
                          <p className="text-sm text-muted-foreground">
                            {SYSTEM_PROMPTS[promptKey]?.description}
                          </p>
                          <div className="flex flex-col gap-2 pt-2">
                            {activeSuggestedPrompts.map((prompt, index) => (
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
                        </>
                      ) : (
                        <>
                          {!isMobile && <h2 className="text-lg font-semibold">Start by choosing a scenario for the assistant</h2>}
                          <p className="text-sm text-muted-foreground">
                            Use the "Choose Scenario" dropdown above to select a mode
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  messages.map((message, index) => {
                    // For tool role messages: show based on display mode
                    if (message.role === 'tool') {
                      if (toolDisplayMode === 'none') return null;
                      const toolParts = message.parts?.filter(p =>
                        p.type?.startsWith('tool-') &&
                        (p.state === 'output-available' || p.state === 'output-error')
                      );
                      if (!toolParts?.length) return null;
                      if (toolDisplayMode === 'brief') {
                        const names = toolParts.map(p => p.type.replace('tool-', ''));
                        const hasError = toolParts.some(p => p.state === 'output-error');
                        return (
                          <Message key={index} from="assistant">
                            <MessageContent>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-1">
                                <WrenchIcon className="size-3" />
                                <span>Used {names.join(', ')}</span>
                                {hasError
                                  ? <XCircleIcon className="size-3 text-red-500" />
                                  : <CheckCircleIcon className="size-3 text-green-500" />}
                              </div>
                            </MessageContent>
                          </Message>
                        );
                      }
                      return (
                        <Message key={index} from="assistant">
                          <MessageContent>
                            {toolParts.map(renderToolPart)}
                          </MessageContent>
                        </Message>
                      );
                    }

                    // Skip assistant messages that only have tool calls (no text content)
                    if (message.role === 'assistant' && !message.content && message.tool_calls) {
                      return null;
                    }

                    return (
                      <Message key={index} from={message.role}>
                        <MessageContent>
                          {message.content && <MessageResponse>{message.content}</MessageResponse>}
                        </MessageContent>
                      </Message>
                    );
                  })
                )}
                {isLoading && !(messages.length > 0 && messages[messages.length - 1].role === 'assistant' && messages[messages.length - 1].content) && (
                  <Message from="assistant">
                    <MessageContent>
                      <div className="flex items-center gap-2 text-base text-muted-foreground">
                        <Loader size={18} />
                        <span>{currentThinkingMessage}</span>
                      </div>
                    </MessageContent>
                  </Message>
                )}
              </ConversationContent>
              <ConversationScrollButton />
            </Conversation>
          </div>

          {/* Input Area */}
          <div className={`border-t ${isMobile ? 'p-2' : 'p-4'}`} style={isMobile ? { paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' } : {}}>
            <PromptInput onSubmit={handleSubmit}>
              <PromptInputBody>
                <PromptInputTextarea
                  placeholder={scenarioChosen ? "Type your message..." : "Choose a scenario to start..."}
                  disabled={!scenarioChosen}
                />
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
  );

  const dialogsContent = (
    <>
      {/* API Key Dialog - shown on startup if no key is set */}
      <Dialog open={apiKeyDialogOpen} onOpenChange={setApiKeyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>OpenRouter API Key Required</DialogTitle>
            <DialogDescription>
              Enter your OpenRouter API key to start using the chat. You can get one from your instructor or{' '}
              <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="underline text-primary">
                openrouter.ai
              </a>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="api-key-dialog">API Key</Label>
            <Input
              id="api-key-dialog"
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder=""
              onKeyDown={(e) => {
                if (e.key === 'Enter' && apiKeyInput.trim()) {
                  handleSaveApiKey(apiKeyInput.trim());
                  setApiKeyDialogOpen(false);
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                if (apiKeyInput.trim()) {
                  handleSaveApiKey(apiKeyInput.trim());
                  setApiKeyDialogOpen(false);
                }
              }}
              disabled={!apiKeyInput.trim()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  if (isMobile) {
    return (
      <div ref={mobileContainerRef} style={{ width: '100vw', height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {shouldRenderIframe && (
          <div style={{ flex: `0 0 ${mobileTopPct}%`, overflow: 'hidden', position: 'relative' }}>
            {iframeEl}
            {isDraggingDivider && (
              <div style={{ position: 'absolute', inset: 0, zIndex: 10, cursor: 'row-resize' }} />
            )}
          </div>
        )}
        {shouldRenderIframe && (
          <div
            onMouseDown={handleMobileDrag}
            onTouchStart={handleMobileDrag}
            style={{ height: '12px', flexShrink: 0, background: 'var(--border)', cursor: 'row-resize', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'var(--muted-foreground)', opacity: 0.4 }} />
          </div>
        )}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {chatContent}
        </div>
        {dialogsContent}
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <Group orientation="horizontal" style={{ width: '100%', height: '100%' }}>
        <Panel defaultSize={shouldRenderIframe ? 50 : 0} minSize={shouldRenderIframe ? 20 : 0}>
          {shouldRenderIframe && (
            <div style={{ height: '100%' }}>
              {iframeEl}
            </div>
          )}
        </Panel>
        <Separator className="w-1 bg-border hover:bg-primary/50 transition-colors cursor-col-resize" />
        <Panel defaultSize={shouldRenderIframe ? 50 : 100} minSize={20}>
          {chatContent}
        </Panel>
      </Group>
      {dialogsContent}
    </div>
  );
}
