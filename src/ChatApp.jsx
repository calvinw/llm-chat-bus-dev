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
  { role: 'user', content: 'Hello, can you show me some markdown examples?' },
  { role: 'assistant', content: `# Markdown Rendering Test

Welcome! Here are various markdown examples to test the rendering:

## Text Formatting

You can make text **bold**, *italic*, or ***both***. You can also use ~~strikethrough~~ and \`inline code\`.

## Lists

### Unordered Lists
- First item
- Second item
  - Nested item
  - Another nested item
- Third item

### Ordered Lists
1. First step
2. Second step
3. Third step

### Task Lists
- [x] Completed task
- [ ] Pending task
- [ ] Another pending task

## Code Blocks

### JavaScript Example
\`\`\`javascript
function greet(name) {
  const message = \`Hello, \${name}!\`;
  console.log(message);
  return message;
}

// Arrow function example
const add = (a, b) => a + b;
\`\`\`

### Python Example
\`\`\`python
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

# Print first 10 Fibonacci numbers
for i in range(10):
    print(f"F({i}) = {fibonacci(i)}")
\`\`\`

### CSS Example
\`\`\`css
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.button {
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 10px 20px;
}
\`\`\`

## Blockquotes

> This is a blockquote.
> It can span multiple lines.
>
> — Someone famous

## Tables

| Feature | Status | Priority |
|---------|--------|----------|
| Chat UI | ✅ Done | High |
| Settings | ✅ Done | Medium |
| Tools | 🚧 In Progress | High |
| MCP | 📋 Planned | Low |

## Links and Images

[Visit GitHub](https://github.com) for more info!

## Horizontal Rules

---

## Emojis

✅ 🎉 🚀 🔥 💡 📝 ❌ ⚠️

## Mathematical Expressions

Inline math: The formula for the area of a circle is $A = \\pi r^2$.

Block math:
$$
e^{i\\pi} + 1 = 0
$$

$$
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$

## Nested Lists

1. Level 1 item
   - Level 2 item
     - Level 3 item
       - Level 4 item
2. Another Level 1
   - Nested item

## Combining Elements

### Tips for Writing Good Code

1. **Keep it simple**
   - Use clear variable names
   - Write short functions
   - Add comments when needed

2. **Follow conventions**
   - Stick to style guides
   - Use consistent formatting

3. **Test your code**
   - Write unit tests
   - Test edge cases
   - Use descriptive test names

\`\`\`javascript
// Example of good code
const calculateTotal = (items) => {
  return items.reduce((sum, item) => sum + item.price, 0);
};
\`\`\`

---

Let me know if you'd like to see more examples!` },

  { role: 'user', content: 'That\'s great! Can you show me how to use the chat interface?' },
  { role: 'assistant', content: `# How to Use This Chat Interface

## Getting Started

1. **Enter your API Key** - Click the **Settings** button and enter your OpenRouter API key
2. **Select a Model** - Choose from available models like GPT-4o, Claude 3.5 Sonnet, etc.
3. **Start Chatting** - Type your message and press Enter

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| \`Enter\` | Send message |
| \`Shift + Enter\` | New line |
| \`Backspace\` | Remove last attachment |

## Features

### ✨ Streaming Responses
Watch responses appear in real-time as they're generated!

### 🔧 Model Selection
Switch between different AI models easily:
- **GPT-4o Mini** - Fast and affordable
- **GPT-4o** - Most capable
- **Claude 3.5 Sonnet** - Great for coding
- **Gemini Pro 1.5** - Google's model
- **DeepSeek Chat** - Budget friendly

### 💾 Persistent Settings
Your API key and model selection are saved automatically!

---

Try sending a message to see it in action! 🚀` },

  { role: 'user', content: 'What about code examples with syntax highlighting?' },
  { role: 'assistant', content: `## Syntax Highlighting Examples

Here are code examples in various programming languages:

### React/JSX
\`\`\`jsx
import { useState } from 'react';

function Counter({ initial = 0 }) {
  const [count, setCount] = useState(initial);

  return (
    <div className="counter">
      <h2>Count: {count}</h2>
      <button onClick={() => setCount(c => c + 1)}>
        Increment
      </button>
      <button onClick={() => setCount(0)}>
        Reset
      </button>
    </div>
  );
}
\`\`\`

### TypeScript
\`\`\`typescript
interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'guest';
}

async function fetchUser(id: number): Promise<User> {
  const response = await fetch(\`/api/users/\${id}\`);
  if (!response.ok) {
    throw new Error('User not found');
  }
  return response.json();
}
\`\`\`

### Rust
\`\`\`rust
fn fibonacci(n: u64) -> u64 {
    match n {
        0 => 0,
        1 => 1,
        _ => fibonacci(n - 1) + fibonacci(n - 2),
    }
}

fn main() {
    for i in 0..10 {
        println!("fib({}) = {}", i, fibonacci(i));
    }
}
\`\`\`

### Go
\`\`\`go
package main

import "fmt"

func fibonacci(n int) int {
    if n <= 1 {
        return n
    }
    return fibonacci(n-1) + fibonacci(n-2)
}

func main() {
    for i := 0; i < 10; i++ {
        fmt.Printf("fib(%d) = %d\\n", i, fibonacci(i))
    }
}
\`\`\`

### SQL
\`\`\`sql
-- Complex query with joins and aggregations
SELECT
    u.name,
    u.email,
    COUNT(o.id) as order_count,
    SUM(o.total) as total_spent
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE o.created_at >= '2024-01-01'
GROUP BY u.id, u.name, u.email
HAVING COUNT(o.id) > 5
ORDER BY total_spent DESC
LIMIT 10;
\`\`\`

### Bash/Shell
\`\`\`bash
#!/bin/bash

# Deploy script
set -e

echo "Starting deployment..."

# Build the project
npm run build

# Run tests
npm test

# Deploy to server
rsync -avz dist/ user@server:/var/www/html/

echo "Deployment complete!"
\`\`\`

---

All code blocks support full syntax highlighting! 🎨` },
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
      <div className="flex-1 min-h-0 overflow-hidden">
        <Conversation className="h-full">
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
