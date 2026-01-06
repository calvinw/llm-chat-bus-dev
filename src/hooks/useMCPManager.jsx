import { useState, useEffect } from 'react';
import { MCPClient } from '../utils/mcpClient.jsx';

/**
 * Hook to manage MCP server connections and tools
 */
const useMCPManager = (transport = 'auto') => {
  const [mcpServerUrl, setMcpServerUrl] = useState('');
  const [mcpTransport, setMcpTransport] = useState(transport);
  const [mcpConnectionStatus, setMcpConnectionStatus] = useState(null);
  const [mcpTools, setMcpTools] = useState([]);
  const [mcpToolHandlers, setMcpToolHandlers] = useState({});
  const [mcpClient, setMcpClient] = useState(null);
  const [useCorsProxy, setUseCorsProxy] = useState(false);

  // Connect to MCP server when URL changes
  useEffect(() => {
    const connectToMCP = async () => {
      if (!mcpServerUrl || !mcpServerUrl.trim()) {
        // Clear MCP state when URL is empty
        setMcpConnectionStatus(null);
        setMcpTools([]);
        setMcpToolHandlers({});
        if (mcpClient) {
          mcpClient.disconnect();
          setMcpClient(null);
        }
        return;
      }

      try {
        setMcpConnectionStatus('connecting');
        
        let targetUrl = mcpServerUrl;
        if (useCorsProxy) {
          // Use corsproxy.io
          // Usually: https://corsproxy.io/?url=<encoded_url>
          // Or just appended. Docs say appended: https://corsproxy.io/?https://...
          targetUrl = `https://corsproxy.io/?${encodeURIComponent(mcpServerUrl)}`;
          console.log('Using CORS Proxy:', targetUrl);
        }

        // Create new MCP client with transport
        const client = new MCPClient(targetUrl, mcpTransport);
        const result = await client.connect();
        
        if (result.success) {
          setMcpClient(client);
          setMcpTools(result.tools);
          
          // Create tool handlers
          const handlers = {};
          for (const tool of result.tools) {
            const toolName = tool.function.name;
            handlers[toolName] = async (args) => {
              return await client.callTool(toolName, args);
            };
          }
          setMcpToolHandlers(handlers);
          
          setMcpConnectionStatus('connected');
          console.log('Successfully connected to MCP server:', mcpServerUrl);
        } else {
          setMcpConnectionStatus('error');
          setMcpTools([]);
          setMcpToolHandlers({});
          setMcpClient(null);
          console.error('Failed to connect to MCP server:', result.error);
        }
      } catch (error) {
        console.error('Error connecting to MCP server:', error);
        setMcpConnectionStatus('error');
        setMcpTools([]);
        setMcpToolHandlers({});
        setMcpClient(null);
      }
    };

    // Debounce the connection attempt
    const timeoutId = setTimeout(connectToMCP, 1000);
    return () => clearTimeout(timeoutId);
  }, [mcpServerUrl, mcpTransport, useCorsProxy]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mcpClient) {
        mcpClient.disconnect();
      }
    };
  }, [mcpClient]);

  return {
    mcpServerUrl,
    setMcpServerUrl,
    mcpTransport,
    setMcpTransport,
    mcpConnectionStatus,
    mcpTools,
    mcpToolHandlers,
    mcpClient,
    useCorsProxy,
    setUseCorsProxy
  };
};

export default useMCPManager;