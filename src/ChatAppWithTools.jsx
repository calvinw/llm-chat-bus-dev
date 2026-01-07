import { useState } from 'react';
import LLMChatInterface from './LLMChatInterface';

/**
 * Simple tool definition for adding two numbers
 * Follows OpenAI function calling format
 */
const addNumbersTool = {
  type: "function",
  function: {
    name: "add_numbers",
    description: "Add two numbers together and return the result",
    parameters: {
      type: "object",
      properties: {
        a: {
          type: "number",
          description: "The first number"
        },
        b: {
          type: "number",
          description: "The second number"
        }
      },
      required: ["a", "b"]
    }
  }
};

/**
 * Tool handler implementation
 * This function executes when the LLM calls the add_numbers tool
 */
const addNumbersHandler = ({ a, b }) => {
  const result = a + b;
  console.log(`add_numbers called with: ${a} + ${b} = ${result}`);
  return {
    result: result,
    message: `The sum of ${a} and ${b} is ${result}`
  };
};

/**
 * Tool handlers object maps tool names to their implementations
 */
const toolHandlers = {
  add_numbers: addNumbersHandler
};

/**
 * Tools array - can include multiple tools
 */
const tools = [addNumbersTool];

export default function ChatAppWithTools() {
  const [apiKey, setApiKey] = useState(
    localStorage.getItem('openrouter-api-key') || ''
  );

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Simple header */}
      <header style={{
        padding: '1rem 2rem',
        borderBottom: '1px solid #e5e7eb',
        backgroundColor: '#f9fafb'
      }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>
          LLM Chat with Tools Example
        </h1>
        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
          Try asking: "What is 123 plus 456?" or "Add 100 and 250"
        </p>
      </header>

      {/* Chat Interface */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <LLMChatInterface
          apiKey={apiKey}
          enableTools={true}
          tools={tools}
          toolHandlers={toolHandlers}
          toolChoice="auto"
          parallelToolCalls={true}
          defaultModel="google/gemini-3.0-flash-preview"
          height="100%"
          showModelSelector={true}
          showClearButton={true}
          showDisplayModeToggle={true}
        />
      </div>
    </div>
  );
}
