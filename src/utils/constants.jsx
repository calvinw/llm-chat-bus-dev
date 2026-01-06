/**
 * Application constants and configuration
 */

export const DEFAULT_SYSTEM_PROMPT = "";

export const MESSAGE_ROLES = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system',
  TOOL: 'tool',
  TOOL_EXECUTION: 'tool_execution'
};

export const DISPLAY_MODES = {
  MARKDOWN: 'markdown',
  TEXT: 'text'
};

export const API_CONFIG = {
  BASE_URL: 'https://openrouter.ai/api/v1'
};

export const TOOL_CHOICE_OPTIONS = {
  NONE: 'none',
  AUTO: 'auto',
  REQUIRED: 'required'
};

export const TOOL_CALL_STATUS = {
  PENDING: 'pending',
  EXECUTING: 'executing',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

export default {
  DEFAULT_SYSTEM_PROMPT,
  MESSAGE_ROLES,
  DISPLAY_MODES,
  API_CONFIG,
  TOOL_CHOICE_OPTIONS,
  TOOL_CALL_STATUS
};