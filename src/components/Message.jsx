import React, { useRef, useImperativeHandle, useEffect, forwardRef } from 'react';
import {
  Message as AIMessage,
  MessageContent,
  MessageResponse,
} from '@/components/ai-elements/message';
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from '@/components/ai-elements/tool';

const Message = forwardRef(({ message, renderMessage, index, isStreaming, displayMode, messages = [], tools = [] }, ref) => {
  // Handle different message types
  if (message.role === 'tool') {
    // Tool result messages are now handled as separate tool_execution messages
    return null;
  }

  // Handle tool execution messages using AI Elements Tool component
  if (message.role === 'tool_execution' && message.toolExecution) {
    const { toolCall, toolResult } = message.toolExecution;

    // Helper to get full display args with defaults from schema
    const getFullDisplayArgs = () => {
      const toolDef = tools?.find(t => t.function?.name === toolCall.name);
      const properties = toolDef?.function?.parameters?.properties;

      if (!properties) return toolCall.arguments;

      const displayArgs = { ...toolCall.arguments };

      Object.keys(properties).forEach(key => {
        if (!(key in displayArgs) && properties[key]?.default !== undefined) {
          displayArgs[key] = properties[key].default;
        }
      });

      return displayArgs;
    };

    return (
      <Tool defaultOpen={false}>
        <ToolHeader
          title={toolCall.name}
          type={`tool-${toolCall.name}`}
          state="output-available"
        />
        <ToolContent>
          <ToolInput input={getFullDisplayArgs()} />
          <ToolOutput output={toolResult} />
        </ToolContent>
      </Tool>
    );
  }

  // Regular user/assistant messages
  const isUser = message.role === 'user';
  
  // Helper function to normalize math delimiters
  const normalizeMathDelimiters = (text) => {
    if (!text) return "";
    return text
      .replace(/\\\[/g, "$$")
      .replace(/\\\]/g, "$$")
      .replace(/\\\(/g, "$")
      .replace(/\\\)/g, "$");
  };

  // Local state for content to allow efficient streaming updates
  const [internalContent, setInternalContent] = React.useState(normalizeMathDelimiters(message.content));

  // Sync state with prop changes
  useEffect(() => {
    setInternalContent(normalizeMathDelimiters(message.content));
  }, [message.content]);

  // For AI messages, we need a content ref for direct DOM manipulation during streaming
  const contentRef = useRef(null);

  // Expose content ref to parent for streaming updates
  useImperativeHandle(ref, () => ({
    updateContent: (content) => {
      setInternalContent(normalizeMathDelimiters(content));
      // Only trigger MathJax rendering in markdown mode
      if (displayMode === 'markdown' && window.MathJax && window.MathJax.typesetPromise) {
        // We need to wait for React to render the new content
        setTimeout(() => {
            if (contentRef.current) {
            window.MathJax.typesetPromise([contentRef.current])
                .catch(err => console.error('MathJax rendering failed:', err));
            }
        }, 0);
      }
    },
    getContentElement: () => contentRef.current
  }), [displayMode]);

  useEffect(() => {
    if (displayMode === 'markdown' && window.MathJax && window.MathJax.typesetPromise) {
      const timer = setTimeout(() => {
        if (contentRef.current) {
          window.MathJax.typesetPromise([contentRef.current])
            .catch(err => console.error('MathJax rendering failed:', err));
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [internalContent, displayMode]);

  // Content classes for text mode
  const textModeClasses = displayMode === 'text' ? 'font-mono text-sm whitespace-pre-wrap' : '';

  return (
    <AIMessage from={isUser ? 'user' : 'assistant'}>
      <MessageContent className={textModeClasses}>
        <div ref={contentRef} className="w-full">
            {displayMode === 'text' ? (
                <div className="whitespace-pre-wrap">{internalContent}</div>
            ) : (
                <div className="prose prose-sm max-w-none dark:prose-invert [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                    <MessageResponse>
                        {internalContent}
                    </MessageResponse>
                </div>
            )}
        </div>
      </MessageContent>
    </AIMessage>
  );
});

Message.displayName = 'Message';

export default Message;
