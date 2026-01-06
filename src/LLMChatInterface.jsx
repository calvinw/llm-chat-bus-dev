import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import useChatEngine from './hooks/useChatEngine.jsx';
import useModelManager from './hooks/useModelManager.jsx';
import useMarkdownRenderer from './hooks/useMarkdownRenderer.jsx';
import useMCPManager from './hooks/useMCPManager.jsx';
import ErrorDisplay from './components/ErrorDisplay.jsx';
import MessagesContainer from './components/MessagesContainer.jsx';
import MessageInput from './components/MessageInput.jsx';
import Sidebar from './components/Sidebar.jsx';
import TabHeader from './components/TabHeader.jsx';
import SystemPromptTab from './components/SystemPromptTab.jsx';

const LLMChatInterface = ({
  apiKey: propApiKey = null,
  defaultModel = "openai/gpt-4o-mini",
  systemPrompt = "",
  tools = null,
  toolHandlers = null,
  enableTools = false,
  toolChoice = "auto",
  parallelToolCalls = true,
  onToolCall = null,
  customModels = null,
  className = "",
  height = "600px",
  showHeader = true,
  showModelSelector = true,
  showClearButton = true,
  showDisplayModeToggle = true,
  onMessage = null,
  onError = null,
  theme = "light",
  sidebarPosition = "right" // New prop: "left" or "right"
}) => {
  const [apiKey, setApiKey] = useState(propApiKey || localStorage.getItem('openrouter-api-key') || '');
  const [displayMode, setDisplayMode] = useState('markdown');
  const [error, setError] = useState(null);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  // const [activeTab, setActiveTab] = useState('messages'); // Removed: No longer using tabs
  const activeTab = 'messages'; // Force messages tab
  const [currentSystemPrompt, setCurrentSystemPrompt] = useState(systemPrompt);
  const messagesEndRef = useRef(null);

  // MCP Manager for remote tool servers
  const {
    mcpServerUrl,
    setMcpServerUrl,
    mcpTransport,
    setMcpTransport,
    mcpConnectionStatus,
    mcpTools,
    mcpToolHandlers,
    mcpClient
  } = useMCPManager();

  // Save API key to localStorage (only if not provided as prop)
  useEffect(() => {
    if (apiKey && !propApiKey) {
      localStorage.setItem('openrouter-api-key', apiKey);
    }
  }, [apiKey, propApiKey]);

  // Merge local tools with MCP tools
  const mergedTools = useMemo(() => {
    if (!enableTools) return null;
    
    const localTools = tools || [];
    const allTools = [...localTools, ...mcpTools];
    
        
    return allTools;
  }, [enableTools, tools, mcpTools]);

  // Merge local tool handlers with MCP tool handlers
  const mergedToolHandlers = useMemo(() => {
    if (!enableTools) return null;
    
    const localHandlers = toolHandlers || {};
    const allHandlers = { ...localHandlers, ...mcpToolHandlers };
    
        
    return allHandlers;
  }, [enableTools, toolHandlers, mcpToolHandlers]);

  // Handle tool calling callback with user notification
  const handleToolCall = useCallback((toolName, args, result, error) => {
    if (onToolCall) {
      onToolCall(toolName, args, result, error);
    }
    
    if (error && onError) {
      onError(error);
    }
  }, [onToolCall, onError]);

  const {
    messages,
    isLoading,
    isStreaming,
    sendMessage,
    clearMessages,
    currentModel,
    setCurrentModel,
    registerStreamingCallbacks
  } = useChatEngine(
    apiKey, 
    defaultModel, 
    currentSystemPrompt,
    mergedTools,
    mergedToolHandlers,
    toolChoice,
    parallelToolCalls,
    handleToolCall
  );
  
  const { models, modelsLoading } = useModelManager(customModels, apiKey);
  const { renderMessage } = useMarkdownRenderer(displayMode);

  // Auto-scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Auto-scroll effect - trigger after messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // MathJax rendering effect - only trigger when streaming stops
  useEffect(() => {
    if (displayMode === 'markdown' && !isStreaming && window.MathJax && window.MathJax.typesetPromise) {
      // Small delay to ensure DOM is updated
      const timer = setTimeout(() => {
        window.MathJax.typesetPromise()
          .catch(err => console.error('MathJax rendering failed:', err));
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [isStreaming, displayMode]);


  const handleSendMessage = async (message) => {
    if (!message.trim() || isLoading || isStreaming || !apiKey) return;
    
    try {
      setError(null);
      await sendMessage(message);
      
      // Notify parent component of message
      if (onMessage) {
        // Get the last assistant message from the messages array
        const lastAssistantMessage = messages
          .filter(msg => msg.role === 'assistant')
          .pop();
        onMessage(message, lastAssistantMessage?.content || '');
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setError(err);
      if (onError) {
        onError(err);
      }
    }
  };

  const handleNewChat = () => {
    if (window.confirm('Are you sure you want to start a new chat?')) {
      clearMessages();
      setError(null);
    }
  };

  const toggleSidebar = () => {
    setSidebarVisible(!sidebarVisible);
  };

  // Removed: No longer using tabs
  // const tabs = [
  //   { id: 'messages', label: 'Messages' },
  //   { id: 'system', label: 'System Prompt' }
  // ];

  const handleSystemPromptChange = (newPrompt) => {
    setCurrentSystemPrompt(newPrompt);
  };

  return (
    <div className={`llm-chat-container ${className} ${theme === 'dark' ? 'llm-chat-dark' : 'llm-chat-light'} relative flex h-full`} style={{ height }}>
      {sidebarPosition === 'left' && (
        <Sidebar
          isVisible={sidebarVisible}
          onToggle={toggleSidebar}
          onNewChat={handleNewChat}
          apiKey={apiKey}
          onApiKeyChange={setApiKey}
          displayMode={displayMode}
          onDisplayModeChange={setDisplayMode}
          currentModel={currentModel}
          setCurrentModel={setCurrentModel}
          models={models}
          modelsLoading={modelsLoading}
          isLoading={isLoading || isStreaming}
          mcpServerUrl={mcpServerUrl}
          onMcpServerUrlChange={setMcpServerUrl}
          mcpTransport={mcpTransport}
          onMcpTransportChange={setMcpTransport}
          mcpConnectionStatus={mcpConnectionStatus}
          sidebarPosition={sidebarPosition}
        />
      )}
      {/* Main Chat Area */}
      <div className={`flex-1 min-w-0 flex flex-col transition-all duration-300 h-full ${sidebarVisible ? (sidebarPosition === 'right' ? 'lg:mr-[260px] mr-0' : 'lg:ml-[260px] ml-0') : (sidebarPosition === 'right' ? 'lg:mr-[60px] mr-0' : 'lg:ml-[60px] ml-0' )}`}>
        {/* Tab Header */}
        
        {/* Error Message Display Area */}
        <ErrorDisplay error={error} />
        
        {/* Tab Content Area */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Messages Tab Content */}
            <MessagesContainer
              messages={messages}
              isLoading={isLoading}
              isStreaming={isStreaming}
              renderMessage={renderMessage}
              messagesEndRef={messagesEndRef}
              registerStreamingCallbacks={registerStreamingCallbacks}
              displayMode={displayMode}
              tools={mergedTools}
              onSendMessage={handleSendMessage}
              // suggestions={[]} // Suggestions moved to MessageInput
            />

            {/* Message Input Area - anchored to bottom */}
            <MessageInput
              onSendMessage={handleSendMessage}
              isLoading={isLoading || isStreaming}
              apiKey={apiKey}
              suggestions={[
                "Can you give me some sample markdown?",
                "Can you explain conjoint analysis with math?"
              ]}
            />
          
          {/* System Prompt Tab Content */}
            {/* <SystemPromptTab
              systemPrompt={currentSystemPrompt}
              onSystemPromptChange={handleSystemPromptChange}
            /> */}
        </div>
      </div>
      {sidebarPosition === 'right' && (
        <Sidebar
          isVisible={sidebarVisible}
          onToggle={toggleSidebar}
          onNewChat={handleNewChat}
          apiKey={apiKey}
          onApiKeyChange={setApiKey}
          displayMode={displayMode}
          onDisplayModeChange={setDisplayMode}
          currentModel={currentModel}
          setCurrentModel={setCurrentModel}
          models={models}
          modelsLoading={modelsLoading}
          isLoading={isLoading || isStreaming}
          mcpServerUrl={mcpServerUrl}
          onMcpServerUrlChange={setMcpServerUrl}
          mcpTransport={mcpTransport}
          onMcpTransportChange={setMcpTransport}
          mcpConnectionStatus={mcpConnectionStatus}
          sidebarPosition={sidebarPosition}
        />
      )}
    </div>
  );
};

export default LLMChatInterface;