import React, { useRef, useEffect } from 'react';
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputButton,
  PromptInputActionMenu,
  PromptInputActionMenuTrigger,
  PromptInputActionMenuContent,
  PromptInputActionAddAttachments,
} from '@/components/ai-elements/prompt-input';
import { PlusIcon } from 'lucide-react';
import { Suggestion } from '@/components/ai-elements/suggestion';


const MessageInput = ({ onSendMessage, isLoading, apiKey, suggestions = [] }) => {
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!isLoading && apiKey && textareaRef.current) {
      // Use a small timeout to ensure the disabled state is cleared in the DOM
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 10);
      return () => clearTimeout(timer);
    }
  }, [isLoading, apiKey]);

  const handleSubmit = ({ text }) => {
    if (text.trim()) {
      onSendMessage(text);
    }
  };

  return (
    <div className="p-4 bg-white flex-shrink-0">
      <PromptInput
        onSubmit={handleSubmit}
        disabled={isLoading || !apiKey}
        className="w-full"
      >
        <PromptInputHeader />
        <PromptInputTextarea
          ref={textareaRef}
          placeholder="Ask your question"
          disabled={isLoading || !apiKey}
        />
        <PromptInputFooter>
          <PromptInputActionMenu>
            <PromptInputActionMenuTrigger>
              <PlusIcon className="size-4" />
            </PromptInputActionMenuTrigger>
            <PromptInputActionMenuContent>
              <PromptInputActionAddAttachments label="Add photos or files" />
            </PromptInputActionMenuContent>
          </PromptInputActionMenu>
          <PromptInputSubmit
            disabled={isLoading || !apiKey}
            status={isLoading ? 'submitted' : undefined}
          />
        </PromptInputFooter>
      </PromptInput>
      {suggestions.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {suggestions.map((suggestion, index) => (
            <Suggestion
              key={index}
              suggestion={suggestion}
              onClick={onSendMessage}
              variant="outline"
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default MessageInput;
