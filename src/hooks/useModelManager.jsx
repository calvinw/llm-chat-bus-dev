import { useState, useEffect } from 'react';
/**
 * Custom hook for managing AI models
 * Handles fetching models from OpenRouter API or using custom models
 */

import { OpenRouterClient } from '../utils/apiClient.jsx';

const useModelManager = (customModels, apiKey) => {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchModels = async () => {
      try {
        setLoading(true);
        setError(null);

        if (customModels) {
          // Use provided custom models
          if (isMounted) {
            setModels(customModels);
            setLoading(false);
          }
          return;
        }

        // Fetch all models from OpenRouter API like original
        const client = new OpenRouterClient(apiKey || 'dummy');
        const fetchedModels = await client.getModels();
        
        // Sort models alphabetically like original
        const sortedModels = fetchedModels.sort((a, b) => a.id.localeCompare(b.id));

        if (isMounted) {
          setModels(sortedModels);
          setLoading(false);
          console.log(`Loaded ${sortedModels.length} models`);
        }
      } catch (err) {
        console.error('Failed to fetch models:', err);
        if (isMounted) {
          setError(err);
          setLoading(false);
          // Fallback to default model if API call fails
          setModels([
            { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fallback model when API is unavailable' }
          ]);
        }
      }
    };

    fetchModels();

    return () => {
      isMounted = false;
    };
  }, [customModels, apiKey]);


  return {
    models,
    loading,
    error
  };
};

export default useModelManager;