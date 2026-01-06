import { useCallback } from 'react';

/**
 * Custom hook for managing tool execution
 * Handles parallel tool execution and error handling
 */
const useToolManager = (toolHandlers, onToolCall) => {
  
  const executeTools = useCallback(async (toolCalls) => {
    if (!toolCalls || toolCalls.length === 0) {
      return [];
    }

    // Execute all tools in parallel
    const toolPromises = toolCalls.map(async (toolCall) => {
      const { id, function: { name, arguments: argsString } } = toolCall;
      
      try {
        // Parse arguments
        let args = {};
        if (argsString && argsString.trim()) {
          console.log(`Parsing arguments for ${name}:`, argsString);
          args = JSON.parse(argsString);
        }
        
        // Find handler
        const handler = toolHandlers?.[name];
        if (!handler) {
          throw new Error(`No handler registered for tool: ${name}`);
        }
        
        // Execute tool
        const result = await handler(args);
        
        // Create tool result message
        const toolResult = {
          role: "tool",
          tool_call_id: id,
          content: JSON.stringify(result)
        };
        
        // Notify callback of success
        if (onToolCall) {
          onToolCall(name, args, result, null);
        }
        
        return toolResult;
        
      } catch (error) {
        console.error(`Tool execution failed for ${name}:`, error);
        console.error(`Raw arguments string was:`, argsString);
        
        // Create error result
        const errorResult = {
          role: "tool",
          tool_call_id: id,
          content: JSON.stringify({
            error: true,
            message: error.message
          })
        };
        
        // Notify callback of error
        if (onToolCall) {
          try {
            const args = argsString ? JSON.parse(argsString) : {};
            onToolCall(name, args, null, error);
          } catch (parseError) {
            onToolCall(name, { _raw: argsString }, null, error);
          }
        }
        
        return errorResult;
      }
    });

    // Wait for all tools to complete
    const results = await Promise.all(toolPromises);
    return results;
    
  }, [toolHandlers, onToolCall]);

  const validateTools = useCallback((tools) => {
    if (!Array.isArray(tools)) {
      console.warn('Tools must be an array');
      return false;
    }

    for (const tool of tools) {
      if (tool.type !== 'function') {
        console.warn('Tool type must be "function"');
        return false;
      }

      if (!tool.function?.name || !tool.function?.description) {
        console.warn('Tool must have name and description');
        return false;
      }
    }

    return true;
  }, []);

  return { 
    executeTools,
    validateTools
  };
};

export default useToolManager;