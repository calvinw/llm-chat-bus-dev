import { useCallback, useState } from 'react';

/**
 * Serverless OpenRouter chat hook using direct fetch
 * Works directly in the browser with no backend needed
 * Supports tool calling with AI Elements compatible parts structure
 */
export function useOpenRouterChat(initialMessages = [], tools = null, toolHandlers = null) {
  const [messages, setMessages] = useState(initialMessages);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

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

    try {
      // Build messages array for API call (without parts, but with tool_calls)
      const apiMessages = newMessages.map(m => {
        if (m.role === 'tool') {
          // Tool result message
          return {
            role: 'tool',
            tool_call_id: m.tool_call_id,
            content: m.content || (typeof m.output === 'string' ? m.output : JSON.stringify(m.output))
          };
        }
        // Include tool_calls for assistant messages that have them
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

      // Build request body with tools if available
      const requestBody = {
        model,
        messages: apiMessages,
        stream: true,
      };

      if (tools && tools.length > 0) {
        requestBody.tools = tools;
        requestBody.tool_choice = 'auto';
      }

      // Stream response from OpenRouter using fetch
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

      // Handle the streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';
      let currentAssistantMessage = null;
      let toolCalls = [];

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

                    if (!currentAssistantMessage) {
                      currentAssistantMessage = { role: 'assistant', content: fullContent, parts: [{ type: 'text', text: fullContent }] };
                      setMessages(prev => [...prev, currentAssistantMessage]);
                    } else {
                      currentAssistantMessage.content = fullContent;
                      currentAssistantMessage.parts[0] = { type: 'text', text: fullContent };
                      setMessages(prev => {
                        const updated = [...prev];
                        updated[updated.length - 1] = { ...currentAssistantMessage };
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

      // After streaming completes, handle tool calls if present
      if (toolCalls.length > 0) {
        // Ensure assistant message exists
        if (!currentAssistantMessage) {
          currentAssistantMessage = {
            role: 'assistant',
            content: fullContent || '',
            parts: []
          };
          setMessages(prev => [...prev, currentAssistantMessage]);
        }

        // Update the assistant message with final tool parts
        const finalToolParts = toolCallsToParts(toolCalls, 'input-available');
        const parts = [
          { type: 'text', text: fullContent },
          ...finalToolParts
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

        // Make another API call with tool results
        setStatus('streaming');

        // Build follow-up messages with ONE assistant message containing ALL tool_calls
        // followed by ALL tool results
        const followUpMessages = [
          ...apiMessages,
          {
            role: 'assistant',
            content: fullContent || '',
            tool_calls: toolCalls  // All tool calls in one message
          },
          ...toolResults.map(tr => ({
            role: 'tool',
            tool_call_id: tr.tool_call_id,
            content: tr.output?.summary || (tr.output ? JSON.stringify(tr.output) : tr.errorText)
          }))
        ];

        const followUpResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': window.location.href,
            'X-Title': 'FIT Retail Index Chat',
          },
          body: JSON.stringify({
            model,
            messages: followUpMessages,
            stream: true,
            tools,
          }),
        });

        if (!followUpResponse.ok) {
          throw new Error(`Follow-up API error: ${followUpResponse.status}`);
        }

        // Stream the follow-up response (with tool call support for chaining)
        const followUpReader = followUpResponse.body.getReader();
        let followUpContent = '';
        let followUpBuffer = '';
        let followUpAssistantMessage = null;
        let followUpToolCalls = [];

        while (true) {
          const { done, value } = await followUpReader.read();
          if (done) break;

          followUpBuffer += decoder.decode(value, { stream: true });
          const lines = followUpBuffer.split('\n');
          followUpBuffer = lines.pop() || '';

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
                      followUpContent += delta.content;

                      if (!followUpAssistantMessage) {
                        followUpAssistantMessage = {
                          role: 'assistant',
                          content: followUpContent,
                          parts: [{ type: 'text', text: followUpContent }]
                        };
                        setMessages(prev => [...prev, followUpAssistantMessage]);
                      } else {
                        followUpAssistantMessage.content = followUpContent;
                        followUpAssistantMessage.parts = [{ type: 'text', text: followUpContent }];
                        setMessages(prev => {
                          const updated = [...prev];
                          updated[updated.length - 1] = { ...followUpAssistantMessage };
                          return updated;
                        });
                      }
                    }

                    // Handle tool calls in follow-up (for chaining)
                    if (delta.tool_calls) {
                      for (const toolCall of delta.tool_calls) {
                        const existingCall = followUpToolCalls.find(tc => tc.index === toolCall.index);

                        if (existingCall) {
                          if (toolCall.id) existingCall.id = toolCall.id;
                          if (toolCall.function?.name) {
                            existingCall.function.name = toolCall.function.name;
                          }
                          if (toolCall.function?.arguments) {
                            existingCall.function.arguments += toolCall.function.arguments;
                          }
                        } else {
                          followUpToolCalls.push({
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
                // Ignore parse errors
              }
            }
          }
        }

        // Handle chained tool calls from follow-up response
        if (followUpToolCalls.length > 0) {
          console.log('Chained tool calls detected:', followUpToolCalls);

          // Ensure assistant message exists
          if (!followUpAssistantMessage) {
            followUpAssistantMessage = {
              role: 'assistant',
              content: followUpContent || '',
              parts: []
            };
            setMessages(prev => [...prev, followUpAssistantMessage]);
          }

          // Update with tool parts
          const chainedToolParts = toolCallsToParts(followUpToolCalls, 'input-available');
          followUpAssistantMessage.tool_calls = followUpToolCalls;
          followUpAssistantMessage.content = followUpContent || '';
          followUpAssistantMessage.parts = [
            { type: 'text', text: followUpContent },
            ...chainedToolParts
          ];

          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { ...followUpAssistantMessage };
            return updated;
          });

          // Execute chained tools
          setStatus('executing_tools');
          const chainedResults = await Promise.all(followUpToolCalls.map(tc => executeTool(tc)));

          // Add chained tool results to messages
          const chainedToolMessages = chainedResults.map(result => ({
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

          setMessages(prev => [...prev, ...chainedToolMessages]);

          // Continue with another follow-up for chained results
          setStatus('streaming');

          const chainedFollowUpMessages = [
            ...followUpMessages,
            {
              role: 'assistant',
              content: followUpContent || '',
              tool_calls: followUpToolCalls
            },
            ...chainedResults.map(tr => ({
              role: 'tool',
              tool_call_id: tr.tool_call_id,
              content: tr.output?.summary || (tr.output ? JSON.stringify(tr.output) : tr.errorText)
            }))
          ];

          const chainedResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
              'HTTP-Referer': window.location.href,
              'X-Title': 'FIT Retail Index Chat',
            },
            body: JSON.stringify({
              model,
              messages: chainedFollowUpMessages,
              stream: true,
              tools,
            }),
          });

          if (chainedResponse.ok) {
            // Stream final response (no more tool chaining to keep it simple)
            const chainedReader = chainedResponse.body.getReader();
            let chainedContent = '';
            let chainedBuffer = '';
            let chainedAssistantMessage = null;

            while (true) {
              const { done, value } = await chainedReader.read();
              if (done) break;

              chainedBuffer += decoder.decode(value, { stream: true });
              const lines = chainedBuffer.split('\n');
              chainedBuffer = lines.pop() || '';

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed === 'data: [DONE]') continue;
                if (trimmed.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(trimmed.slice(6));
                    const delta = data.choices?.[0]?.delta?.content;
                    if (delta) {
                      chainedContent += delta;

                      if (!chainedAssistantMessage) {
                        chainedAssistantMessage = {
                          role: 'assistant',
                          content: chainedContent,
                          parts: [{ type: 'text', text: chainedContent }]
                        };
                        setMessages(prev => [...prev, chainedAssistantMessage]);
                      } else {
                        chainedAssistantMessage.content = chainedContent;
                        chainedAssistantMessage.parts = [{ type: 'text', text: chainedContent }];
                        setMessages(prev => {
                          const updated = [...prev];
                          updated[updated.length - 1] = { ...chainedAssistantMessage };
                          return updated;
                        });
                      }
                    }
                  } catch (e) {
                    // Ignore parse errors
                  }
                }
              }
            }
          }
        }
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
