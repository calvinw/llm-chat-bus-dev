/**
 * OpenRouter API client for LLM communication
 * Handles both streaming and non-streaming requests
 */

export class OpenRouterClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://openrouter.ai/api/v1';
  }

  /**
   * Make a streaming chat completion request with tool support
   * @param {Array} messages - Array of message objects
   * @param {string} model - Model ID to use
   * @param {Array} tools - Optional array of tool definitions
   * @param {string|object} toolChoice - Tool choice setting ("auto", "none", "required", or specific tool)
   * @param {boolean} parallelToolCalls - Whether to allow parallel tool calls
   * @param {Function} onChunk - Callback for each content chunk
   * @param {Function} onToolCall - Callback when tool calls are detected
   * @param {Function} onComplete - Callback when streaming completes
   * @param {Function} onError - Callback for errors
   */
  async streamCompletion(messages, model, tools = null, toolChoice = "auto", parallelToolCalls = true, onChunk, onToolCall, onComplete, onError) {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'LLM Chat Interface'
        },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          ...(tools && tools.length > 0 && {
            tools,
            tool_choice: toolChoice,
            parallel_tool_calls: parallelToolCalls
          })
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';
      let currentToolCalls = [];
      let updateCount = 0;

      // Throttle updates for performance (same as vanilla JS)
      const shouldUpdate = () => {
        updateCount++;
        return updateCount % 6 === 0; // Update every 6th chunk
      };

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          onComplete(accumulatedContent, currentToolCalls.length > 0 ? currentToolCalls : null);
          break;
        }

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            
            if (data === '[DONE]') {
              onComplete(accumulatedContent, currentToolCalls.length > 0 ? currentToolCalls : null);
              return;
            }
            
            if (!data) continue;

            try {
              const parsed = JSON.parse(data);
              
              // Skip OpenRouter comment payloads
              if (parsed.type === 'comment') {
                continue;
              }
              
              const delta = parsed.choices?.[0]?.delta;
              const finishReason = parsed.choices?.[0]?.finish_reason;
              
              // Handle regular content
              if (delta?.content) {
                accumulatedContent += delta.content;
                
                // Update UI periodically for smooth streaming
                if (shouldUpdate()) {
                  onChunk(accumulatedContent);
                }
              }
              
              // Handle tool calls
              if (delta?.tool_calls) {
                delta.tool_calls.forEach((toolCall) => {
                  // OpenAI streaming sends tool_calls with an index property
                  const toolIndex = toolCall.index !== undefined ? toolCall.index : currentToolCalls.length;
                  
                  // Initialize tool call if it doesn't exist
                  if (!currentToolCalls[toolIndex]) {
                    currentToolCalls[toolIndex] = {
                      id: toolCall.id || '',
                      type: toolCall.type || 'function',
                      function: { name: '', arguments: '' }
                    };
                  }
                  
                  // Update ID if provided (it might come in later chunks)
                  if (toolCall.id) {
                    currentToolCalls[toolIndex].id = toolCall.id;
                  }
                  
                  // Accumulate function name
                  if (toolCall.function?.name) {
                    currentToolCalls[toolIndex].function.name += toolCall.function.name;
                  }
                  
                  // Accumulate function arguments
                  if (toolCall.function?.arguments) {
                    currentToolCalls[toolIndex].function.arguments += toolCall.function.arguments;
                  }
                });
                
                // Debug log to see what we're accumulating
                console.log('Current tool calls state:', currentToolCalls.map((tc, i) => ({
                  index: i,
                  id: tc?.id,
                  name: tc?.function?.name,
                  args: tc?.function?.arguments
                })));
              }
              
              // Check if tool calls are complete
              if (finishReason === 'tool_calls' && currentToolCalls.length > 0) {
                // Filter out any undefined/incomplete tool calls and log final state
                const completedToolCalls = currentToolCalls.filter(tc => tc && tc.function && tc.function.name);
                console.log('Final tool calls being sent:', completedToolCalls);
                
                if (onToolCall) {
                  // Call onToolCall to handle tool execution
                  onToolCall(completedToolCalls, accumulatedContent);
                } else {
                  // Fallback: call onComplete with tool calls if no onToolCall handler
                  onComplete(accumulatedContent, completedToolCalls);
                }
                return;
              }
            } catch (parseError) {
              console.warn('Failed to parse streaming chunk:', parseError);
              continue;
            }
          }
        }
      }
    } catch (error) {
      console.error('Streaming request failed:', error);
      onError(error);
    }
  }


  /**
   * Make a non-streaming chat completion request (fallback)
   * @param {Array} messages - Array of message objects
   * @param {string} model - Model ID to use
   * @param {Array} tools - Optional array of tool definitions
   * @param {string|object} toolChoice - Tool choice setting
   * @param {boolean} parallelToolCalls - Whether to allow parallel tool calls
   * @returns {Promise<object>} - The completion response with content and tool_calls
   */
  async getCompletion(messages, model, tools = null, toolChoice = "auto", parallelToolCalls = true) {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'LLM Chat Interface'
        },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          ...(tools && tools.length > 0 && {
            tools,
            tool_choice: toolChoice,
            parallel_tool_calls: parallelToolCalls
          })
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
      }

      const data = await response.json();
      const message = data.choices?.[0]?.message;
      return {
        content: message?.content || '',
        tool_calls: message?.tool_calls || null
      };
    } catch (error) {
      console.error('Non-streaming request failed:', error);
      throw error;
    }
  }

  /**
   * Fetch available models from OpenRouter
   * @returns {Promise<Array>} - Array of model objects
   */
  async getModels() {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'LLM Chat Interface'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Failed to fetch models:', error);
      throw error;
    }
  }
}

export default OpenRouterClient;
