import { useState, useMemo } from 'react';
/**
 * Chat engine hook with tool calling support
 * Manages messages, API communication, and tool execution
 */

import { OpenRouterClient } from '../utils/apiClient.jsx';
import { DEFAULT_SYSTEM_PROMPT, MESSAGE_ROLES } from '../utils/constants.jsx';
import useToolManager from './useToolManager.jsx';
import useStreamingEngine from './useStreamingEngine.jsx';

const useChatEngine = (apiKey, defaultModel, systemPrompt = DEFAULT_SYSTEM_PROMPT, tools = null, toolHandlers = null, toolChoice = "auto", parallelToolCalls = true, onToolCall = null) => {
  // State management
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentModel, setCurrentModel] = useState(defaultModel);
  const [error, setError] = useState(null);

  // API client instance
  const apiClient = useMemo(() => {
    return apiKey ? new OpenRouterClient(apiKey) : null;
  }, [apiKey]);

  // Tool manager for executing tools
  const { executeTools } = useToolManager(toolHandlers, onToolCall);

  // Streaming engine for handling streaming responses and tool integration
  const {
    isStreaming,
    setIsStreaming,
    registerStreamingCallbacks,
    handleToolCallsInResponse,
    fallbackToNonStreaming,
    streamingCallbacksRef
  } = useStreamingEngine(apiClient, currentModel, tools, toolChoice, parallelToolCalls, executeTools, onToolCall);

  // Generate unique message ID
  const generateMessageId = () => {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  // Add a new message with optional tool calls or tool execution data
  const addMessage = (role, content, toolCalls = null, toolCallId = null, toolExecution = null) => {
    const newMessage = {
      id: generateMessageId(),
      role,
      content,
      timestamp: Date.now(),
      ...(toolCalls && { tool_calls: toolCalls }),
      ...(toolCallId && { tool_call_id: toolCallId }),
      ...(toolExecution && { toolExecution })
    };

    setMessages(prev => [...prev, newMessage]);
    return newMessage;
  };

  // Send a message and get AI response with tool support
  const sendMessage = async (userMessage) => {
    if (!apiClient) {
      throw new Error('API key is required');
    }

    if (!userMessage.trim()) {
      throw new Error('Message cannot be empty');
    }

    if (isLoading || isStreaming) {
      throw new Error('Already processing a message');
    }

    setError(null);
    setIsLoading(true);

    // Add user message
    const userMsg = addMessage(MESSAGE_ROLES.USER, userMessage.trim());
    
    // Add placeholder AI message for streaming updates
    const aiMsg = addMessage(MESSAGE_ROLES.ASSISTANT, '');

    try {
      // Prepare messages for API (include system message if provided and conversation history)
      const apiMessages = [
        ...(systemPrompt ? [{ role: MESSAGE_ROLES.SYSTEM, content: systemPrompt }] : []),
        ...messages
          .filter(msg => msg.role !== MESSAGE_ROLES.TOOL_EXECUTION) // Filter out display-only tool execution messages
          .map(msg => {
            const message = { role: msg.role, content: msg.content };
            if (msg.tool_calls) message.tool_calls = msg.tool_calls;
            if (msg.tool_call_id) message.tool_call_id = msg.tool_call_id;
            return message;
          }),
        { role: MESSAGE_ROLES.USER, content: userMessage.trim() }
      ];

      setIsStreaming(true);
      setIsLoading(false);

      // Start streaming with tool support
      await apiClient.streamCompletion(
        apiMessages,
        currentModel,
        tools,
        toolChoice,
        parallelToolCalls,
        // onChunk callback - forward to streaming engine callbacks
        (accumulatedContent) => {
          // Forward to streaming engine for UI updates
          if (streamingCallbacksRef && streamingCallbacksRef.current && streamingCallbacksRef.current.onChunk) {
            streamingCallbacksRef.current.onChunk(accumulatedContent);
          }
        },
        // onToolCall callback - handle tool calls in streaming
        async (toolCalls, finalContent = '') => {
          console.log('Tool calls detected:', toolCalls);
          await handleToolCallsInResponse(finalContent, toolCalls, addMessage, setMessages, apiMessages);
        },
        // onComplete callback
        (finalContent, toolCalls) => {
          console.log('onComplete called with:', { finalContent, toolCalls: toolCalls?.length || 0 });
          setIsStreaming(false);
          setIsLoading(false);
          
          if (toolCalls && toolCalls.length > 0) {
            console.log('Handling tool calls in onComplete');
            handleToolCallsInResponse(finalContent, toolCalls, addMessage, setMessages, apiMessages);
          } else {
            // Regular text response - update final message
            setMessages(prev => {
              const newMessages = [...prev];
              const lastIndex = newMessages.length - 1;
              if (newMessages[lastIndex] && newMessages[lastIndex].role === MESSAGE_ROLES.ASSISTANT) {
                newMessages[lastIndex] = { ...newMessages[lastIndex], content: finalContent };
              }
              return newMessages;
            });
          }
        },
        // onError callback
        async (streamingError) => {
          await fallbackToNonStreaming(streamingError, apiMessages, addMessage, setMessages);
        }
      );

    } catch (error) {
      console.error('Error sending message:', error);
      setError(error);
      setIsLoading(false);
      setIsStreaming(false);
      throw error;
    }
  };

  // Clear all messages
  const clearMessages = () => {
    setMessages([]);
    setError(null);
  };

  return {
    // State
    messages,
    isLoading,
    isStreaming,
    currentModel,
    error,
    
    // Actions
    sendMessage,
    clearMessages,
    setCurrentModel,
    registerStreamingCallbacks,
    
    // Computed
    hasMessages: messages.length > 0
  };
};

export default useChatEngine;