import React from 'react';

const Sidebar = ({ 
    isVisible, 
    onToggle, 
    onNewChat, 
    apiKey, 
    onApiKeyChange, 
    displayMode, 
    onDisplayModeChange,
    currentModel,
    setCurrentModel,
    models,
    modelsLoading,
    isLoading,
    mcpServerUrl,
    onMcpServerUrlChange,
    mcpTransport,
    onMcpTransportChange,
    mcpConnectionStatus,
    sidebarPosition = "right" // New prop
}) => {
    return (
        <div className="relative h-full">
            {/* Single Sidebar - changes width based on isVisible state */}
            <div className={`absolute ${sidebarPosition === 'right' ? 'right-0' : 'left-0'} top-0 h-full bg-white ${sidebarPosition === 'right' ? 'border-l' : 'border-r'} border-gray-200 text-gray-900 transition-all duration-300 z-20 ${
                isVisible ? 'lg:w-[260px] w-[260px]' : 'lg:w-[60px] w-0 lg:block hidden'
            } ${
                isVisible ? 'translate-x-0' : `lg:translate-x-0 ${sidebarPosition === 'right' ? 'translate-x-full' : '-translate-x-full'}`
            }`}>
                {/* Header - Hamburger Menu */}
                <div className="flex items-center p-3 border-b border-gray-200">
                    <button
                        onClick={onToggle}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                        aria-label={isVisible ? "Minimize sidebar" : "Expand sidebar"}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                </div>

                {/* New Chat Button */}
                <div className="p-3">
                    <button
                        onClick={onNewChat}
                        className={`w-full flex items-center rounded-lg hover:bg-gray-100 transition-colors text-gray-700 ${
                            isVisible ? 'gap-3 p-3' : 'justify-center p-2'
                        }`}
                        title="New Chat"
                    >
                        <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        {isVisible && <span>New Chat</span>}
                    </button>
                </div>

                {/* Chat History Section - Only show when expanded */}
                {isVisible && (
                    <div className="flex-1 overflow-y-auto px-3">
                        {/* Empty space for future chat history */}
                    </div>
                )}

                {/* Settings Section - Only show when expanded */}
                {isVisible && (
                    <div className="border-t border-gray-200 p-4 space-y-4">
                        <div className="text-sm font-medium text-gray-700">Settings</div>
                        
                        {/* API Key Input */}
                        <div>
                            <label className="block text-xs text-gray-600 mb-1">
                                OpenRouter API Key
                            </label>
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => onApiKeyChange(e.target.value)}
                                placeholder="Enter your API key"
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                        
                        {/* Model Selection */}
                        <div>
                            <label className="block text-xs text-gray-600 mb-1">
                                AI Model
                            </label>
                            <select 
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
                                value={currentModel}
                                onChange={(e) => setCurrentModel(e.target.value)}
                                disabled={isLoading || modelsLoading}
                                title="Choose which AI model to use for responses"
                            >
                                {modelsLoading ? (
                                    <option value="">Loading models...</option>
                                ) : (
                                    models.map(model => (
                                        <option key={model.id} value={model.id}>
                                            {model.id}
                                        </option>
                                    ))
                                )}
                            </select>
                        </div>

                        {/* Display Mode Toggle */}
                        <div>
                            <label className="block text-xs text-gray-600 mb-1">
                                Display Mode
                            </label>
                            <select
                                value={displayMode}
                                onChange={(e) => onDisplayModeChange(e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            >
                                <option value="markdown">Markdown</option>
                                <option value="text">Plain Text</option>
                            </select>
                        </div>

                        {/* MCP Transport Selection */}
                        <div>
                            <label className="block text-xs text-gray-600 mb-1">
                                MCP Transport
                            </label>
                            <select
                                value={mcpTransport || 'auto'}
                                onChange={(e) => onMcpTransportChange?.(e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                title="Select MCP transport protocol"
                            >
                                <option value="auto">Auto-detect</option>
                                <option value="streamable-http">Streamable HTTP</option>
                                <option value="sse-legacy">SSE Legacy</option>
                            </select>
                        </div>

                        {/* MCP Server URL Input */}
                        <div>
                            <label className="block text-xs text-gray-600 mb-1">
                                MCP Server URL
                                {mcpConnectionStatus && (
                                    <span className={`ml-2 text-xs ${
                                        mcpConnectionStatus === 'connected' ? 'text-green-600' : 
                                        mcpConnectionStatus === 'error' ? 'text-red-600' : 
                                        'text-yellow-600'
                                    }`}>
                                        ({mcpConnectionStatus})
                                    </span>
                                )}
                            </label>
                            <input
                                type="url"
                                value={mcpServerUrl}
                                onChange={(e) => onMcpServerUrlChange(e.target.value)}
                                placeholder="http://localhost:8001/mcp or http://localhost:8002/sse"
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                title="Enter the URL of an MCP server to load additional tools"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Floating hamburger menu for mobile when sidebar is closed */}
            {!isVisible && (
                <button
                    onClick={onToggle}
                    className={`lg:hidden absolute top-4 ${sidebarPosition === 'right' ? 'right-4' : 'left-4'} z-30 p-3 bg-white rounded-full shadow-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors`}
                    aria-label="Open sidebar"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>
            )}

            {/* Overlay for mobile */}
            {isVisible && (
                <div
                    className="absolute inset-0 bg-black bg-opacity-50 z-10 lg:hidden"
                    onClick={onToggle}
                />
            )}

        </div>
    );
};

export default Sidebar;