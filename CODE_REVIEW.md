# Code Review Findings

Review date: 2026-02-14

## 1. Stale `messages` closure in `useOpenRouterChat` (Bug)

`src/hooks/useOpenRouterChat.jsx:94` — `sendMessage` captures `messages` at call time:
```js
let newMessages = [...messages, userMessage];
```
But later API messages are built from this snapshot (line 220). If a user manages to submit while streaming is in progress, the old `messages` reference would be stale, potentially dropping messages. The `sendMessage` dependency on `messages` also means it's constantly recreated during streaming.

## 2. Direct mutation of React state objects (Bug)

`src/hooks/useOpenRouterChat.jsx:168-169,276-278` — The code mutates `assistantMessage` directly:
```js
assistantMessage.content = fullContent;
assistantMessage.parts[0] = { type: 'text', text: fullContent };
```
Then passes the same object reference to `setMessages`. React may skip re-renders when it detects the same object reference. The spread at line 173 (`{ ...assistantMessage }`) helps, but the underlying object is still being mutated across iterations.

## 3. Shared `TextDecoder` across multiple streams (Bug)

`src/hooks/useOpenRouterChat.jsx:99` — A single `TextDecoder` is created before the tool-calling loop. When `decode()` is called with `{ stream: true }`, it buffers incomplete multibyte characters. If a stream ends mid-character, those buffered bytes carry over into the next `streamResponse()` call (a completely different HTTP response), potentially corrupting the first characters of the next response.

## 4. `toolCallsToParts` can throw unhandled JSON parse error (Bug)

`src/hooks/useOpenRouterChat.jsx:69` — `JSON.parse(args)` is called without try/catch:
```js
const input = args && args.trim() ? JSON.parse(args) : {};
```
If the LLM returns malformed tool call arguments, this throws and crashes the entire send flow. The same parsing in `executeTool` (line 24) is similarly unprotected.

## 5. `exportMarkdown` uses wrong property name for tool name (Bug)

`src/utils/exportMarkdown.jsx:39` — Uses `message.name` but tool messages are created with `toolName` in `useOpenRouterChat.jsx:295`. So exported markdown always shows "unknown" for tool result names:
```js
const toolName = message.name || 'unknown'; // should be message.toolName
```

## 6. Race condition in MCP connection (Minor Bug)

`src/hooks/useMCPManager.jsx:20-87` — The effect debounces with `setTimeout` and clears it on cleanup, but doesn't abort in-flight `client.connect()` calls. Rapidly changing the URL can cause multiple concurrent connection attempts, with the last `setMcpClient()` winning but earlier connections not being cleaned up. The stale `mcpClient` reference at line 29 may also fail to disconnect the previous client.

## 7. `html: true` in markdown-it renderers (Security)

`src/utils/exportPdf.jsx:59` and `src/utils/mathProcessor.jsx:123` — Both create markdown-it instances with `html: true`. Since the rendered content comes from LLM responses, a model could return raw HTML (e.g., `<script>`, `<img onerror>`) that would be rendered. The print window in `exportPdf` is particularly exposed since it uses `document.write()`. Low severity since it's LLM-generated content in a print popup, but worth being aware of.

## 8. Unsanitized CSS injection in print export (Security)

`src/utils/exportPdf.jsx:74` — Iframe CSS rules are injected directly into a `<style>` tag:
```js
<style>${iframeStyles || ''}</style>
```
No sanitization is applied. A malicious stylesheet could use CSS-based attacks (e.g., `url()` data exfiltration). Mitigated by same-origin restriction on iframe access.

## 9. `createMarkdownRenderer` is likely dead code

`src/utils/mathProcessor.jsx:120-162` — This function (along with its `codeToHtml` import from shiki) doesn't appear to be used anywhere. `MessageResponse` uses Streamdown directly, and `exportPdf.jsx` creates its own markdown-it instance. The shiki import adds unnecessary bundle weight.

## 10. No concurrent send guard (UX)

The `PromptInput` passes `status` to `PromptInputSubmit`, but if the submit component doesn't disable during `streaming`/`executing_tools` status, users could fire multiple concurrent sends, triggering the stale closure issue from #1. The suggested prompts correctly use `disabled={isLoading}`, but the main input may not.

## 11. Un-memoized tools/handlers cause unnecessary callback recreation (Performance)

`src/ChatApp.jsx:583-584` — `mergedTools` and `mergedToolHandlers` are recomputed on every render without `useMemo`. Since these flow into `useOpenRouterChat` and end up in dependency arrays of `useCallback`, every ChatApp re-render recreates `sendMessage` and `executeTool`.
