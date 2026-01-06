import { useState } from 'react';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import {
  Message,
  MessageContent,
  MessageResponse,
} from '@/components/ai-elements/message';
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputTools,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputSelect,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSelectContent,
  PromptInputSelectItem,
} from '@/components/ai-elements/prompt-input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MessageSquare, RotateCcw, Settings } from 'lucide-react';

// Available models
const MODELS = [
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
  { id: 'openai/gpt-4o', name: 'GPT-4o' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
  { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku' },
  { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5' },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat' },
];

// Dummy initial messages
const INITIAL_MESSAGES = [
  { role: 'user', content: 'Hello, how are you?' },
  { role: 'assistant', content: 'Hi! I am doing well, thank you for asking. How can I help you today?' },
  { role: 'user', content: 'Can you explain React hooks?' },
  { role: 'assistant', content: 'React hooks are functions that let you use state and other React features in functional components. The most common hooks are:\n\n- **useState**: Manages local state\n- **useEffect**: Handles side effects\n- **useContext**: Accesses context values\n- **useRef**: Creates mutable references\n\nWould you like me to explain any of these in more detail?' },
];

export default function ChatApp() {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [status, setStatus] = useState('idle');

  // Settings state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState(localStorage.getItem('openrouter_api_key') || '');
  const [selectedModel, setSelectedModel] = useState(() => {
    return localStorage.getItem('openrouter_model') || MODELS[0].id;
  });

  // Save API key to localStorage
  const handleSaveApiKey = (key) => {
    setApiKey(key);
    localStorage.setItem('openrouter_api_key', key);
    console.log('API key saved to localStorage');
  };

  // Save model to localStorage
  const handleSaveModel = (modelId) => {
    setSelectedModel(modelId);
    localStorage.setItem('openrouter_model', modelId);
    console.log('Model saved to localStorage:', modelId);
  };

  // Simple local message handler - just adds to the list
  const handleSubmit = async (message) => {
    console.log('Form submitted with:', message);
    console.log('Current settings:', { apiKey: apiKey ? '***set***' : 'not set', model: selectedModel });

    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: message.text }]);

    // Simulate a response
    setStatus('streaming');
    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `This is a dummy response to: "${message.text}"\n\nThe UI is working! You can now type messages and see them appear in the conversation.\n\n**Current Settings:**\n- API Key: ${apiKey ? 'Set' : 'Not set'}\n- Model: ${MODELS.find(m => m.id === selectedModel)?.name}`
      }]);
      setStatus('idle');
    }, 1000);
  };

  // Clear conversation
  const handleClearConversation = () => {
    console.log('Clearing conversation');
    setMessages([]);
  };

  const selectedModelName = MODELS.find(m => m.id === selectedModel)?.name || 'Select Model';

  return (
    <div className="flex h-screen w-full flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="size-5" />
          <h1 className="text-xl font-semibold">AI Chat</h1>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
            {selectedModelName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearConversation}
            disabled={messages.length === 0}
          >
            <RotateCcw className="size-4 mr-2" />
            New Chat
          </Button>
          <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm">
                <Settings className="size-4 mr-2" />
                Settings
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80">
              <SheetHeader>
                <SheetTitle>Settings</SheetTitle>
              </SheetHeader>
              <div className="space-y-6 py-6">
                {/* API Key Input */}
                <div className="space-y-2">
                  <Label htmlFor="api-key">OpenRouter API Key</Label>
                  <Input
                    id="api-key"
                    type="password"
                    value={apiKey}
                    onChange={(e) => handleSaveApiKey(e.target.value)}
                    placeholder="sk-or-..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Get your API key from{' '}
                    <a
                      href="https://openrouter.ai/keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-foreground"
                    >
                      openrouter.ai
                    </a>
                  </p>
                  {apiKey && (
                    <p className="text-xs text-green-600 dark:text-green-400">
                      ✓ API key is set
                    </p>
                  )}
                </div>

                {/* Model Selector */}
                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  <select
                    id="model"
                    value={selectedModel}
                    onChange={(e) => handleSaveModel(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {MODELS.map(model => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Selected: {selectedModelName}
                  </p>
                </div>

                {/* Info Box */}
                <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                  <p className="font-medium mb-1">Current Configuration:</p>
                  <ul className="space-y-1">
                    <li>• API Key: {apiKey ? '✓ Set' : '✗ Not set'}</li>
                    <li>• Model: {selectedModelName}</li>
                  </ul>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Conversation Area */}
      <div className="flex-1 overflow-hidden">
        <Conversation>
          <ConversationContent>
            {messages.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center">
                <div className="max-w-md space-y-2">
                  <MessageSquare className="mx-auto size-12 text-muted-foreground" />
                  <h2 className="text-lg font-semibold">Start a conversation</h2>
                  <p className="text-sm text-muted-foreground">
                    Type a message below to test the UI
                  </p>
                </div>
              </div>
            ) : (
              messages.map((message, index) => (
                <Message key={index} from={message.role}>
                  <MessageContent>
                    <MessageResponse>{message.content}</MessageResponse>
                  </MessageContent>
                </Message>
              ))
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      </div>

      {/* Input Area */}
      <div className="border-t p-4">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputBody>
            <PromptInputTextarea placeholder="Type your message..." />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <span className="text-sm text-muted-foreground px-2">
                {selectedModelName}
              </span>
            </PromptInputTools>
            <PromptInputSubmit status={status} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
