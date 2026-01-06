import { useCallback, useState } from 'react';

/**
 * Serverless OpenRouter chat hook using direct fetch
 * Works directly in the browser with no backend needed
 */
export function useOpenRouterChat(initialMessages = []) {
  const [messages, setMessages] = useState(initialMessages);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  /**
   * Send a message to OpenRouter and stream the response
   */
  const sendMessage = useCallback(async (content, options = {}) => {
    const { model = 'openai/gpt-4o-mini', systemPrompt } = options;

    const apiKey = localStorage.getItem('openrouter_api_key');
    if (!apiKey) {
      setError(new Error('Please enter your OpenRouter API key in settings'));
      return;
    }

    // Add user message
    const userMessage = { role: 'user', content };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setError(null);
    setStatus('streaming');

    try {
      // Build messages array (filter out system messages for the API call)
      const apiMessages = newMessages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role, content: m.content }));

      // Add system prompt if provided
      if (systemPrompt) {
        apiMessages.unshift({ role: 'system', content: systemPrompt });
      }

      // Stream response from OpenRouter using fetch
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': window.location.href,
          'X-Title': 'FIT Retail Index Chat',
        },
        body: JSON.stringify({
          model,
          messages: apiMessages,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} - ${errorData}`);
      }

      // Handle the streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (trimmed.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmed.slice(6));
              const delta = data.choices?.[0]?.delta?.content;
              if (delta) {
                fullContent += delta;
                setMessages(prev => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];

                  if (lastMsg?.role === 'assistant') {
                    lastMsg.content = fullContent;
                  } else {
                    updated.push({ role: 'assistant', content: fullContent });
                  }
                  return updated;
                });
              }
            } catch (e) {
              // Ignore parse errors for incomplete JSON
            }
          }
        }
      }

      setStatus('idle');
    } catch (err) {
      console.error('OpenRouter API error:', err);
      setError(err);
      setStatus('error');

      // Add error message
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `**Error:** ${err.message}\n\nPlease check your API key and try again.`
        }
      ]);

      setTimeout(() => setStatus('idle'), 3000);
    }
  }, [messages]);

  /**
   * Clear all messages
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    status,
    error,
    sendMessage,
    clearMessages,
    isLoading: status === 'streaming',
  };
}
