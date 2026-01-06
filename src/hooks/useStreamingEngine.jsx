import { useState, useRef, useCallback } from 'react';
import { MESSAGE_ROLES } from '../utils/constants.jsx';

/**
 * Custom hook for managing streaming responses and tool integration
 * Extracted from useChatEngine to separate concerns
 */
const useStreamingEngine = (apiClient, currentModel, tools, toolChoice, parallelToolCalls, executeTools, onToolCall) => {
  const [isStreaming, setIsStreaming] = useState(false);
  
  // Ref for streaming callbacks to access latest state
  const streamingCallbacksRef = useRef({});

  // Register streaming callbacks (used by components for direct DOM manipulation)
  const registerStreamingCallbacks = useCallback((callbacks) => {
    streamingCallbacksRef.current = callbacks;
  }, []);

  // Continue conversation with tool results (internal helper)
  const continueConversationWithTools = async (toolResults, currentApiMessages, addMessage, setMessages) => {
    try {
      // Tool execution messages are already created in handleToolCallsInResponse
      // No need to add tool result messages here

      // Prepare API messages by extending the current conversation
      const apiMessages = [
        ...currentApiMessages,
        ...toolResults.map(result => ({
          role: MESSAGE_ROLES.TOOL,
          content: result.content,
          tool_call_id: result.tool_call_id
        }))
      ];

      // Add placeholder for new AI response
      const aiMsg = addMessage(MESSAGE_ROLES.ASSISTANT, '');

      setIsStreaming(true);

      // Continue conversation with tool results
      await apiClient.streamCompletion(
        apiMessages,
        currentModel,
        tools,
        toolChoice,
        parallelToolCalls,
        // onChunk callback
        (accumulatedContent) => {
          if (streamingCallbacksRef.current.onChunk) {
            streamingCallbacksRef.current.onChunk(accumulatedContent);
          }
        },
        // onToolCall callback - handle nested tool calls
        async (toolCalls, accumulatedContent = '') => {
          console.log('Tool calls detected in streaming:', toolCalls);
          
          // Update the current AI message with content (no tool_calls)
          setMessages(prev => {
            const newMessages = [...prev];
            const lastIndex = newMessages.length - 1;
            if (newMessages[lastIndex] && newMessages[lastIndex].role === MESSAGE_ROLES.ASSISTANT) {
              newMessages[lastIndex] = { 
                ...newMessages[lastIndex], 
                content: accumulatedContent 
              };
            }
            return newMessages;
          });

          // Execute tools
          const nestedToolResults = await executeTools(toolCalls);

          // Create tool execution messages for nested calls
          toolCalls.forEach((toolCall, index) => {
            const toolResult = nestedToolResults[index];
            let parsedArgs = {};
            try {
              parsedArgs = JSON.parse(toolCall.function.arguments);
            } catch (e) {
              parsedArgs = { _raw: toolCall.function.arguments };
            }

            let parsedResult = {};
            try {
              parsedResult = JSON.parse(toolResult.content);
            } catch (e) {
              parsedResult = { _raw: toolResult.content };
            }

            console.log('Creating tool execution message from streaming:', {
              role: MESSAGE_ROLES.TOOL_EXECUTION,
              toolCall: {
                name: toolCall.function.name,
                arguments: parsedArgs
              },
              toolResult: parsedResult
            });

            addMessage(MESSAGE_ROLES.TOOL_EXECUTION, '', null, null, {
              toolCall: {
                name: toolCall.function.name,
                arguments: parsedArgs
              },
              toolResult: parsedResult
            });
          });

          // Continue with nested tool results
          const extendedApiMessages = [
            ...apiMessages,
            {
              role: MESSAGE_ROLES.ASSISTANT,
              content: accumulatedContent,
              tool_calls: toolCalls
            }
          ];

          await continueConversationWithTools(nestedToolResults, extendedApiMessages, addMessage, setMessages);
        },
        // onComplete callback
        (finalContent, toolCalls) => {
          setIsStreaming(false);
          if (toolCalls && toolCalls.length > 0) {
            handleToolCallsInResponse(finalContent, toolCalls, addMessage, setMessages, apiMessages);
          } else {
            // Update final message content
            setMessages(prev => {
              const newMessages = [...prev];
              const lastIndex = newMessages.length - 1;
              if (newMessages[lastIndex] && newMessages[lastIndex].role === MESSAGE_ROLES.ASSISTANT) {
                newMessages[lastIndex] = { 
                  ...newMessages[lastIndex], 
                  content: finalContent 
                };
              }
              return newMessages;
            });

            if (streamingCallbacksRef.current.onComplete) {
              streamingCallbacksRef.current.onComplete(finalContent);
            }
          }
        },
        // onError callback
        async (error) => {
          console.error('Tool continuation streaming failed:', error);
          await fallbackToNonStreaming(error, apiMessages, addMessage, setMessages);
        }
      );
    } catch (error) {
      console.error('Error continuing conversation with tools:', error);
      setIsStreaming(false);
      throw error;
    }
  };

  // Handle tool calls in streaming response
  const handleToolCallsInResponse = async (finalContent, toolCalls, addMessage, setMessages, currentApiMessages) => {
    try {
      // Update the current message with final content, removing if empty
      setMessages(prev => {
        const newMessages = [...prev];
        const lastIndex = newMessages.length - 1;
        if (newMessages[lastIndex] && newMessages[lastIndex].role === MESSAGE_ROLES.ASSISTANT) {
          if (finalContent && finalContent.trim()) {
            newMessages[lastIndex] = { ...newMessages[lastIndex], content: finalContent };
          } else {
            // Remove empty assistant message
            newMessages.splice(lastIndex, 1);
          }
        }
        return newMessages;
      });

      // Execute tools
      const toolResults = await executeTools(toolCalls);

      // Create tool execution messages
      toolCalls.forEach((toolCall, index) => {
        const toolResult = toolResults[index];
        let parsedArgs = {};
        try {
          parsedArgs = JSON.parse(toolCall.function.arguments);
        } catch (e) {
          parsedArgs = { _raw: toolCall.function.arguments };
        }

        let parsedResult = {};
        try {
          parsedResult = JSON.parse(toolResult.content);
        } catch (e) {
          parsedResult = { _raw: toolResult.content };
        }

        console.log('Creating tool execution message:', {
          role: MESSAGE_ROLES.TOOL_EXECUTION,
          toolCall: {
            name: toolCall.function.name,
            arguments: parsedArgs
          },
          toolResult: parsedResult
        });

        addMessage(MESSAGE_ROLES.TOOL_EXECUTION, '', null, null, {
          toolCall: {
            name: toolCall.function.name,
            arguments: parsedArgs
          },
          toolResult: parsedResult
        });
      });

      // Continue conversation with tool results
      const extendedApiMessages = [
        ...currentApiMessages,
        {
          role: MESSAGE_ROLES.ASSISTANT,
          content: finalContent,
          tool_calls: toolCalls
        }
      ];

      await continueConversationWithTools(toolResults, extendedApiMessages, addMessage, setMessages);
    } catch (error) {
      console.error('Error handling tool calls:', error);
      setIsStreaming(false);
      throw error;
    }
  };

  // Fallback to non-streaming when streaming fails
  const fallbackToNonStreaming = async (streamingError, apiMessages, addMessage, setMessages) => {
    console.error('Streaming failed, falling back to non-streaming:', streamingError.message);
    setIsStreaming(false);

    try {
      const result = await apiClient.getCompletion(apiMessages, currentModel, tools, toolChoice, parallelToolCalls);
      
      if (result.tool_calls && result.tool_calls.length > 0) {
        await handleToolCallsInResponse(result.content, result.tool_calls, addMessage, setMessages, apiMessages);
      } else {
        // Update message with result
        setMessages(prev => {
          const newMessages = [...prev];
          const lastIndex = newMessages.length - 1;
          if (newMessages[lastIndex] && newMessages[lastIndex].role === MESSAGE_ROLES.ASSISTANT) {
            newMessages[lastIndex] = { ...newMessages[lastIndex], content: result.content };
          }
          return newMessages;
        });

        if (streamingCallbacksRef.current.onComplete) {
          streamingCallbacksRef.current.onComplete(result.content);
        }
      }
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError.message);
      const errorMessage = `Error: ${fallbackError.message}`;
      
      // Update message with error
      setMessages(prev => {
        const newMessages = [...prev];
        const lastIndex = newMessages.length - 1;
        if (newMessages[lastIndex] && newMessages[lastIndex].role === MESSAGE_ROLES.ASSISTANT) {
          newMessages[lastIndex] = { ...newMessages[lastIndex], content: errorMessage };
        }
        return newMessages;
      });

      throw fallbackError;
    }
  };

  return {
    isStreaming,
    setIsStreaming,
    registerStreamingCallbacks,
    continueConversationWithTools,
    handleToolCallsInResponse,
    fallbackToNonStreaming,
    streamingCallbacksRef
  };
};

export default useStreamingEngine;