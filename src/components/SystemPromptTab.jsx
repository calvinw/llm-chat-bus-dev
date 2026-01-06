import React, { useState, useEffect } from 'react';

const SystemPromptTab = ({ systemPrompt, onSystemPromptChange }) => {
  const [localSystemPrompt, setLocalSystemPrompt] = useState(systemPrompt || '');

  useEffect(() => {
    setLocalSystemPrompt(systemPrompt || '');
  }, [systemPrompt]);

  const handleSave = () => {
    onSystemPromptChange(localSystemPrompt);
  };

  const handleClear = () => {
    setLocalSystemPrompt('');
    onSystemPromptChange('');
  };

  const hasChanges = localSystemPrompt !== systemPrompt;

  return (
    <div className="flex flex-col h-full p-4 space-y-4">
      <div className="flex-shrink-0">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">System Prompt</h2>
        <p className="text-sm text-gray-600 mb-4">
          Define the AI assistant's behavior and instructions. This prompt will be sent with every conversation.
        </p>
      </div>
      
      <div className="flex-1 flex flex-col">
        <textarea
          className="flex-1 w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
          placeholder={`Enter your system prompt here... For example:

You are a helpful AI assistant. Please be concise and accurate in your responses.`}
          value={localSystemPrompt}
          onChange={(e) => setLocalSystemPrompt(e.target.value)}
        />
        
        <div className="flex-shrink-0 flex justify-between items-center mt-4 pt-4 border-t border-gray-200">
          <div className="text-sm text-gray-500">
            {localSystemPrompt.length} characters
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={handleClear}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
              disabled={!localSystemPrompt}
            >
              Clear
            </button>
            
            <button
              onClick={handleSave}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors duration-200 focus:ring-2 focus:ring-blue-500 ${hasChanges ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
              disabled={!hasChanges}
            >
              {hasChanges ? 'Save Changes' : 'Saved'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemPromptTab;