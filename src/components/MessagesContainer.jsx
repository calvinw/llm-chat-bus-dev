import React, { useRef, useEffect, useState } from 'react';
import Message from './Message.jsx';
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import { Shimmer } from '@/components/ai-elements/shimmer';
import { Suggestions, Suggestion } from '@/components/ai-elements/suggestion';
import { MessageCircleIcon } from 'lucide-react';

const MessagesContainer = ({
  messages,
  isLoading,
  isStreaming,
  renderMessage,
  messagesEndRef,
  registerStreamingCallbacks,
  displayMode,
  tools,
  onSendMessage,
  suggestions = []
}) => {
  // Refs for each message (to enable direct DOM updates during streaming)
  const messageRefs = useRef([]);

  // Update refs array when messages change
  useEffect(() => {
    messageRefs.current = messageRefs.current.slice(0, messages.length);
  }, [messages.length]);

  // Set up streaming callbacks (matches vanilla JS updateLastMessage function)
  useEffect(() => {
    if (registerStreamingCallbacks) {
      registerStreamingCallbacks({
        onChunk: (accumulatedContent) => {
          // Find the last AI message and update its content directly (like vanilla JS)
          const lastMessageIndex = messages.length - 1;
          const lastMessage = messages[lastMessageIndex];

          if (lastMessage && lastMessage.role === 'assistant') {
            const messageRef = messageRefs.current[lastMessageIndex];
            if (messageRef && messageRef.updateContent) {
              // Pass raw content to Message component
              messageRef.updateContent(accumulatedContent);
            }
          }
        },
        onComplete: (finalContent) => {
          // Final update when streaming completes
          const lastMessageIndex = messages.length - 1;
          const lastMessage = messages[lastMessageIndex];

          if (lastMessage && lastMessage.role === 'assistant') {
            const messageRef = messageRefs.current[lastMessageIndex];
            if (messageRef && messageRef.updateContent) {
              // Pass raw content
              messageRef.updateContent(finalContent);
            }
          }
        }
      });
    }
  }, [messages, renderMessage, registerStreamingCallbacks, messagesEndRef, displayMode]);

  return (
    <Conversation>
      <ConversationContent>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-6 h-full">
            <ConversationEmptyState
              title="Start a conversation"
              description="Ask me anything to get started"
              icon={<MessageCircleIcon className="w-8 h-8" />}
            />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {messages.map((message, index) => (
                <Message
                  key={message.id || index}
                  ref={el => messageRefs.current[index] = el}
                  message={message}
                  messages={messages}
                  renderMessage={renderMessage}
                  index={index}
                  isStreaming={isStreaming && index === messages.length - 1 && message.role === 'assistant'}
                  displayMode={displayMode}
                  tools={tools}
                />
              ))}

              {/* Loading indicator for non-streaming requests */}
              {isLoading && !isStreaming && (
                <div className="flex justify-center">
                  <Shimmer className="text-sm">Thinking...</Shimmer>
                </div>
              )}
            </div>
          </>
        )}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
};

export default MessagesContainer;
