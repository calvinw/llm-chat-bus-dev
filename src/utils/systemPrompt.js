/**
 * System prompts for the Financial Comparison Assistant
 * Content is read from prompts/*.md at build time and injected by Vite's define config.
 * Edit the markdown files in prompts/ to change prompts — restart the dev server to pick up changes.
 */
const SYSTEM_PROMPTS_RAW = __SYSTEM_PROMPTS__;

export const SYSTEM_PROMPTS = {
  'basic-financials': {
    label: 'Basic Financials',
    description: 'The assistant will explain financial statements step by step, defining terms like Revenue, COGS, and Gross Margin in plain language.',
    file: 'basic-financials',
    prompt: SYSTEM_PROMPTS_RAW.basicFinancials,
  },
  'quiz-basic': {
    label: 'Basic Financials Quiz',
    description: 'The assistant will quiz you on basic financial concepts, asking questions about the data on screen and giving feedback on your answers.',
    file: 'quiz-basic-financials',
    prompt: SYSTEM_PROMPTS_RAW.quizBasicFinancials,
  },
  'advanced-roa': {
    label: 'ROA Analysis',
    description: 'The assistant will guide you through Return on Assets analysis using the Strategic Profit Model, comparing margins and asset turnover across companies.',
    file: 'advanced-roa-analysis',
    prompt: SYSTEM_PROMPTS_RAW.advancedRoa,
  },
  'quiz-roa': {
    label: 'ROA Analysis Quiz',
    description: 'The assistant will quiz you on ROA and the Strategic Profit Model, testing your ability to calculate and interpret margin and turnover tradeoffs.',
    file: 'quiz-roa-analysis',
    prompt: SYSTEM_PROMPTS_RAW.quizRoaAnalysis,
  },
};

export const DEFAULT_PROMPT_KEY = 'advanced-roa';

// Backward-compatible export
export const SYSTEM_PROMPT = SYSTEM_PROMPTS[DEFAULT_PROMPT_KEY].prompt;
