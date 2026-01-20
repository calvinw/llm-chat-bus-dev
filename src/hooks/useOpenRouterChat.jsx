import { useCallback, useState } from 'react';

/**
 * Serverless OpenRouter chat hook using direct fetch
 * Works directly in the browser with no backend needed
 * Supports tool calling with AI Elements compatible parts structure
 * Supports unlimited tool call chaining and parallel tool execution
 */
export function useOpenRouterChat(initialMessages = [], tools = null, toolHandlers = null) {
  const [messages, setMessages] = useState(initialMessages);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  // Maximum number of tool call rounds to prevent infinite loops
  const MAX_TOOL_ROUNDS = 20;

  /**
   * Execute a tool call
   */
  const executeTool = useCallback(async (toolCall) => {
    const { function: { name, arguments: args }, id } = toolCall;

    // Parse the arguments JSON string to an object (handle empty string)
    const parsedArgs = typeof args === 'string' && args.trim() ? JSON.parse(args) : (args || {});

    const handler = toolHandlers?.[name];

    if (!handler) {
      console.error(`No handler found for tool: ${name}`);
      return {
        tool_call_id: id,
        toolName: name,
        state: 'output-error',
        errorText: `Unknown tool: ${name}`,
        input: parsedArgs
      };
    }

    try {
      console.log(`Executing tool: ${name}`, parsedArgs);
      const result = await handler(parsedArgs);
      console.log(`Tool result:`, result);

      return {
        tool_call_id: id,
        toolName: name,
        state: 'output-available',
        input: parsedArgs,
        output: result
      };
    } catch (err) {
      console.error(`Tool execution error:`, err);
      return {
        tool_call_id: id,
        toolName: name,
        state: 'output-error',
        input: parsedArgs,
        errorText: err.message
      };
    }
  }, [toolHandlers]);

  /**
   * Convert tool calls to parts format for AI Elements
   */
  const toolCallsToParts = useCallback((toolCalls, state = 'input-available') => {
    return toolCalls.map(tc => {
      const args = tc.function.arguments;
      const input = args && args.trim() ? JSON.parse(args) : {};
      return {
        type: `tool-${tc.function.name}`,
        state,
        toolCallId: tc.id,
        input,
      };
    });
  }, []);

  /**
   * Send a message to OpenRouter and stream the response
   * Supports unlimited tool call chaining
   */
  const sendMessage = useCallback(async (content, options = {}) => {
    const { model = 'openai/gpt-4o-mini', systemPrompt } = options;

    const apiKey = localStorage.getItem('openrouter_api_key');
    if (!apiKey) {
      setError(new Error('Please enter your OpenRouter API key in settings'));
      return;
    }

    // Add user message
    const userMessage = { role: 'user', content, parts: [{ type: 'text', text: content }] };
    let newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setError(null);
    setStatus('streaming');

    const decoder = new TextDecoder();

    // Helper function to stream a response (defined inside sendMessage to avoid adding hooks)
    const streamResponse = async (apiMessages) => {
      const requestBody = {
        model,
        messages: apiMessages,
        stream: true,
      };

      if (tools && tools.length > 0) {
        requestBody.tools = tools;
        requestBody.tool_choice = 'auto';
      }

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': window.location.href,
          'X-Title': 'FIT Retail Index Chat',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} - ${errorData}`);
      }

      const reader = response.body.getReader();
      let fullContent = '';
      let buffer = '';
      let toolCalls = [];
      let assistantMessage = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (trimmed.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmed.slice(6));
              const choice = data.choices?.[0];

              if (choice) {
                const delta = choice.delta;

                if (delta) {
                  // Handle content streaming
                  if (delta.content) {
                    fullContent += delta.content;

                    if (!assistantMessage) {
                      assistantMessage = {
                        role: 'assistant',
                        content: fullContent,
                        parts: [{ type: 'text', text: fullContent }]
                      };
                      setMessages(prev => [...prev, assistantMessage]);
                    } else {
                      assistantMessage.content = fullContent;
                      assistantMessage.parts[0] = { type: 'text', text: fullContent };
                      setMessages(prev => {
                        const updated = [...prev];
                        updated[updated.length - 1] = { ...assistantMessage };
                        return updated;
                      });
                    }
                  }

                  // Handle tool calls (they come in delta chunks)
                  if (delta.tool_calls) {
                    for (const toolCall of delta.tool_calls) {
                      const existingCall = toolCalls.find(tc => tc.index === toolCall.index);

                      if (existingCall) {
                        // Merge partial tool call data
                        if (toolCall.id) existingCall.id = toolCall.id;
                        if (toolCall.function?.name) {
                          existingCall.function.name = toolCall.function.name;
                        }
                        if (toolCall.function?.arguments) {
                          existingCall.function.arguments += toolCall.function.arguments;
                        }
                      } else {
                        // New tool call
                        toolCalls.push({
                          index: toolCall.index,
                          id: toolCall.id,
                          type: toolCall.type || 'function',
                          function: {
                            name: toolCall.function?.name || '',
                            arguments: toolCall.function?.arguments || ''
                          }
                        });
                      }
                    }
                  }
                }
              }
            } catch (e) {
              // Ignore parse errors for incomplete JSON
            }
          }
        }
      }

      return { fullContent, toolCalls, assistantMessage };
    };

    try {
      // Build initial messages array for API call
      let apiMessages = newMessages.map(m => {
        if (m.role === 'tool') {
          return {
            role: 'tool',
            tool_call_id: m.tool_call_id,
            content: m.content || (typeof m.output === 'string' ? m.output : JSON.stringify(m.output))
          };
        }
        const msg = { role: m.role, content: m.content };
        if (m.tool_calls) {
          msg.tool_calls = m.tool_calls;
        }
        return msg;
      });

      // Add system prompt if provided
      if (systemPrompt) {
        apiMessages.unshift({ role: 'system', content: systemPrompt });
      }

      let toolRound = 0;

      // Loop until no more tool calls or max rounds reached
      while (toolRound < MAX_TOOL_ROUNDS) {
        toolRound++;
        console.log(`Tool round ${toolRound}`);

        setStatus('streaming');
        const { fullContent, toolCalls, assistantMessage } = await streamResponse(apiMessages);

        // If no tool calls, we're done
        if (toolCalls.length === 0) {
          console.log('No more tool calls, conversation complete');
          break;
        }

        console.log(`Round ${toolRound}: ${toolCalls.length} tool call(s)`, toolCalls.map(tc => tc.function.name));

        // Ensure assistant message exists for tool calls
        let currentAssistantMessage = assistantMessage;
        if (!currentAssistantMessage) {
          currentAssistantMessage = {
            role: 'assistant',
            content: fullContent || '',
            parts: []
          };
          setMessages(prev => [...prev, currentAssistantMessage]);
        }

        // Update the assistant message with tool parts
        const toolParts = toolCallsToParts(toolCalls, 'input-available');
        const parts = [
          { type: 'text', text: fullContent },
          ...toolParts
        ];

        currentAssistantMessage.tool_calls = toolCalls;
        currentAssistantMessage.content = fullContent || '';
        currentAssistantMessage.parts = parts;

        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...currentAssistantMessage };
          return updated;
        });

        // Execute all tools in parallel
        setStatus('executing_tools');
        const toolResults = await Promise.all(toolCalls.map(tc => executeTool(tc)));

        // Add tool results to messages with proper parts structure
        const toolResultMessages = toolResults.map(result => ({
          role: 'tool',
          content: result.output ? JSON.stringify(result.output) : result.errorText,
          tool_call_id: result.tool_call_id,
          toolName: result.toolName,
          state: result.state,
          input: result.input,
          output: result.output,
          errorText: result.errorText,
          parts: [{
            type: `tool-${result.toolName}`,
            state: result.state,
            toolCallId: result.tool_call_id,
            input: result.input,
            output: result.output,
            errorText: result.errorText
          }]
        }));

        setMessages(prev => [...prev, ...toolResultMessages]);

        // Build messages for next round
        // Include the assistant message with tool_calls and all tool results
        apiMessages = [
          ...apiMessages,
          {
            role: 'assistant',
            content: fullContent || '',
            tool_calls: toolCalls
          },
          ...toolResults.map(tr => ({
            role: 'tool',
            tool_call_id: tr.tool_call_id,
            content: tr.output ? JSON.stringify(tr.output) : tr.errorText
          }))
        ];
      }

      if (toolRound >= MAX_TOOL_ROUNDS) {
        console.warn(`Reached maximum tool rounds (${MAX_TOOL_ROUNDS}), stopping`);
      }

      setStatus('idle');
    } catch (err) {
      console.error('OpenRouter API error:', err);
      setError(err);
      setStatus('error');

      // Add error message
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `**Error:** ${err.message}\n\nPlease check your API key and try again.`,
          parts: [{ type: 'text', text: `**Error:** ${err.message}` }]
        }
      ]);

      setTimeout(() => setStatus('idle'), 3000);
    }
  }, [messages, tools, toolHandlers, executeTool, toolCallsToParts]);

  /**
   * Clear all messages
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    status,
    error,
    sendMessage,
    clearMessages,
    isLoading: status === 'streaming' || status === 'executing_tools',
  };
}
