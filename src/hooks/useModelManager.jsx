import { useState, useEffect } from 'react';

/**
 * Custom hook for managing AI models
 * Handles fetching models from OpenRouter API
 */
export function useModelManager(apiKey) {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchModels = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch all models from OpenRouter API
        const response = await fetch('https://openrouter.ai/api/v1/models', {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': window.location.href,
            'X-Title': 'FIT Retail Index Chat'
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch models: ${response.status}`);
        }

        const data = await response.json();
        const fetchedModels = data.data || [];

        // Sort models alphabetically
        const sortedModels = fetchedModels.sort((a, b) => a.id.localeCompare(b.id));

        if (isMounted) {
          setModels(sortedModels);
          setLoading(false);
          console.log(`Loaded ${sortedModels.length} models from OpenRouter`);
        }
      } catch (err) {
        console.error('Failed to fetch models:', err);
        if (isMounted) {
          setError(err);
          setLoading(false);
          // Fallback to default models if API call fails
          setModels([
            { id: 'google/gemini-3-flash-preview', name: 'Gemini 3 Flash' },
            { id: 'openai/gpt-4o', name: 'GPT-4o' },
            { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
          ]);
        }
      }
    };

    // Only fetch if we have an API key
    if (apiKey) {
      fetchModels();
    } else {
      setLoading(false);
      // Use fallback models when no API key
      setModels([
        { id: 'google/gemini-3-flash-preview', name: 'Gemini 3 Flash' },
        { id: 'openai/gpt-4o', name: 'GPT-4o' },
        { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
      ]);
    }

    return () => {
      isMounted = false;
    };
  }, [apiKey]);

  return {
    models,
    loading,
    error
  };
}
