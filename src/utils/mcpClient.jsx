/**
 * MCP Client with dual transport support
 * Supports both Streamable HTTP and SSE Legacy transports with auto-detection
 * Replaces EventSource with fetch to support header reading (Mcp-Session-Id)
 */

import { HTTPClient } from './httpClient.jsx';

export class MCPClient {
  constructor(serverUrl, transport = 'auto') {
    this.serverUrl = serverUrl;
    this.transport = transport; // 'auto', 'streamable-http', 'sse-legacy'
    this.tools = [];
    this.connected = false;
    this.messageId = 1;
    this.sessionId = null;
    
    // SSE Legacy transport properties
    this.messageEndpoint = null;
    this.pendingRequests = new Map();
    this.abortController = null;
  }

  /**
   * Generate next message ID
   */
  getNextMessageId() {
    return this.messageId++;
  }

  /**
   * Detect which transport the server supports
   */
  async detectTransport() {
    console.log('🔍 Detecting transport for:', this.serverUrl);

    // 1. If URL explicitly ends with /sse, assume SSE Legacy without testing
    if (this.serverUrl.endsWith('/sse')) {
      console.log('✅ SSE endpoint specified, using SSE Legacy transport');
      return 'sse-legacy';
    }

    let streamableHttpDetected = false;

    // 2. Try modern Streamable HTTP (POST)
    try {
      const testMessage = {
        jsonrpc: '2.0',
        id: 'transport-test',
        method: 'ping',
        params: {}
      };

      let response;
      try {
        response = await HTTPClient.post(
          this.serverUrl,
          testMessage,
          { 'Accept': 'application/json, text/event-stream' }
        );
      } catch (postError) {
        // If the error message contains the specific MCP error, we count it as detected
        // BUT we don't return immediately, we still want to prefer SSE if available
        if (postError.message.includes('Missing session ID') || postError.message.includes('missing session id')) {
          console.log('⚠️ Streamable HTTP detected (via Session ID error), checking SSE preference...');
          streamableHttpDetected = true;
        } else {
          throw postError;
        }
      }

      if (response && response.ok) {
        console.log('✅ Streamable HTTP transport detected');
        return 'streamable-http';
      }
    } catch (e) {
      // Just log, don't fail yet
      console.log('ℹ️ Streamable HTTP test result:', e.message);
    }

    // 3. Try SSE Legacy (GET) - but avoid CORS preflight by using simple fetch
    const candidates = [];
    candidates.push(this.serverUrl);

    if (this.serverUrl.endsWith('/mcp')) {
      candidates.push(this.serverUrl.slice(0, -4) + '/sse');
    } else if (!this.serverUrl.endsWith('/sse')) {
      const baseUrl = this.serverUrl.endsWith('/') ? this.serverUrl.slice(0, -1) : this.serverUrl;
      candidates.push(`${baseUrl}/sse`);
    }

    for (const url of candidates) {
      try {
        console.log(`Testing SSE endpoint: ${url}`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        // Use a simple fetch without custom headers to avoid preflight
        const response = await fetch(url, {
          method: 'GET',
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        const contentType = response.headers.get('content-type');
        if (response.ok && contentType && contentType.includes('text/event-stream')) {
          console.log(`✅ SSE Legacy transport detected at ${url}`);
          if (url !== this.serverUrl) {
            console.log(`Using new endpoint: ${url}`);
            this.serverUrl = url;
          }
          return 'sse-legacy';
        }
      } catch (e) {
        console.log(`❌ SSE test failed for ${url}:`, e.message);
      }
    }

    // Fallback: If we detected Streamable HTTP earlier (even with 400), use it
    if (streamableHttpDetected) {
      console.log('↩️ Falling back to Streamable HTTP (despite missing session ID)');
      return 'streamable-http';
    }

    throw new Error('No supported MCP transport detected. If using SSE, ensure the URL points to the /sse endpoint.');
  }

  /**
   * Connect to SSE Legacy transport using fetch (to read headers)
   */
  async connectSSELegacy() {
    console.log('🔗 Connecting via SSE Legacy transport (fetch):', this.serverUrl);
    
    this.abortController = new AbortController();
    
    try {
      // Try with minimal headers first to avoid CORS preflight
      let response;
      try {
        response = await fetch(this.serverUrl, {
          method: 'GET',
          signal: this.abortController.signal
        });
      } catch (preflightError) {
        console.log('Simple fetch failed, trying with Accept header:', preflightError.message);
        response = await fetch(this.serverUrl, {
          method: 'GET',
          headers: {
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache'
          },
          signal: this.abortController.signal
        });
      }

      if (!response.ok) {
        throw new Error(`SSE connection failed: ${response.status} ${response.statusText}`);
      }

      // Extract Session ID from headers
      const sessionId = response.headers.get('Mcp-Session-Id') || response.headers.get('mcp-session-id');
      if (sessionId) {
        this.sessionId = sessionId;
        console.log('🔑 Captured Session ID from headers:', this.sessionId);
      } else {
        console.warn('⚠️ No Mcp-Session-Id header found. Server might not support session persistence.');
      }

      // Start reading the stream
      this.readSSEStream(response.body.getReader());
      
      // Wait for the 'endpoint' event
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout waiting for SSE "endpoint" event'));
        }, 15000);

        this.onEndpoint = (endpoint) => {
          clearTimeout(timeout);
          this.messageEndpoint = endpoint;
          
          // Ensure endpoint is absolute URL
          if (this.messageEndpoint && !this.messageEndpoint.startsWith('http')) {
            const baseUrl = new URL(this.serverUrl);
            if (this.messageEndpoint.startsWith('/')) {
              this.messageEndpoint = `${baseUrl.origin}${this.messageEndpoint}`;
            } else {
              const basePath = baseUrl.pathname.substring(0, baseUrl.pathname.lastIndexOf('/') + 1);
              this.messageEndpoint = `${baseUrl.origin}${basePath}${this.messageEndpoint}`;
            }
          }
          
          console.log('📋 Received message endpoint:', this.messageEndpoint);
          resolve();
        };

        this.onConnectionError = (err) => {
          clearTimeout(timeout);
          reject(err);
        };
      });
      
    } catch (error) {
      console.error('❌ SSE connection error:', error);
      throw error;
    }
  }

  /**
   * Read and parse the SSE stream manually
   */
  async readSSEStream(reader) {
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        
        buffer = lines.pop() || '';
        
        let eventType = 'message';
        
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const data = line.slice(6);
            this.processSSEEvent(eventType, data);
            eventType = 'message';
          } else if (line.trim() === '') {
            eventType = 'message';
          }
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error reading SSE stream:', error);
        if (this.onConnectionError) this.onConnectionError(error);
      }
    }
  }

  processSSEEvent(type, data) {
    try {
      if (type === 'endpoint') {
        if (this.onEndpoint) this.onEndpoint(data.trim());
        return;
      }

      if (type === 'message') {
        const message = JSON.parse(data);
        console.log('📡 Received SSE message:', message);
        
        if (message.id && this.pendingRequests.has(message.id)) {
          const resolver = this.pendingRequests.get(message.id);
          resolver(message);
          this.pendingRequests.delete(message.id);
        }
      }
    } catch (e) {
      console.warn('Failed to parse SSE event:', type, data, e);
    }
  }

  waitForSSEResponse(messageId, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(messageId);
        reject(new Error('SSE response timeout'));
      }, timeout);

      this.pendingRequests.set(messageId, (response) => {
        clearTimeout(timeoutId);
        resolve(response);
      });
    });
  }

  async sendMessage(method, params = {}) {
    if (this.transport === 'sse-legacy') {
      return await this.sendMessageSSELegacy(method, params);
    } else {
      return await this.sendMessageStreamableHTTP(method, params);
    }
  }

  async sendNotification(method, params = {}) {
    if (this.transport === 'sse-legacy') {
      return await this.sendNotificationSSELegacy(method, params);
    } else {
      return await this.sendNotificationStreamableHTTP(method, params);
    }
  }

  async sendMessageSSELegacy(method, params = {}) {
    if (!this.messageEndpoint) {
      throw new Error('SSE Legacy: No message endpoint available');
    }

    const message = {
      jsonrpc: '2.0',
      id: this.getNextMessageId(),
      method: method,
      ...(params !== undefined && Object.keys(params).length > 0 && { params: params })
    };

    console.log(`📤 Sending ${method} via SSE Legacy with ID: ${message.id}`);

    const responsePromise = this.waitForSSEResponse(message.id);

    try {
      await HTTPClient.post(
        this.messageEndpoint,
        message,
        HTTPClient.buildMCPHeaders(this.sessionId, method)
      );
    } catch (error) {
      this.pendingRequests.delete(message.id);
      throw error;
    }

    return await responsePromise;
  }

  async sendNotificationSSELegacy(method, params = {}) {
    if (!this.messageEndpoint) {
      throw new Error('SSE Legacy: No message endpoint available');
    }

    const notification = {
      jsonrpc: '2.0',
      method: method,
      ...(params !== undefined && Object.keys(params).length > 0 && { params: params })
    };

    await HTTPClient.post(
      this.messageEndpoint,
      notification,
      HTTPClient.buildMCPHeaders(this.sessionId, method)
    );

    return { success: true };
  }

  async sendMessageStreamableHTTP(method, params = {}) {
    const message = {
      jsonrpc: '2.0',
      id: this.getNextMessageId(),
      method: method,
      ...(params !== undefined && Object.keys(params).length > 0 && { params: params })
    };

    const headers = HTTPClient.buildMCPHeaders(
      this.sessionId, 
      method, 
      'application/json, text/event-stream'
    );

    const response = await HTTPClient.post(this.serverUrl, message, headers);
    const contentType = response.headers.get('content-type') || '';

    const newSessionId = response.headers.get('Mcp-Session-Id') || response.headers.get('mcp-session-id');
    if (newSessionId && newSessionId !== this.sessionId) {
      this.sessionId = newSessionId;
      console.log('🔑 Updated Session ID:', this.sessionId);
    }

    if (contentType.includes('text/event-stream')) {
      return await this.handleSSEResponse(response);
    } else if (contentType.includes('application/json')) {
      return await response.json();
    } else {
      throw new Error(`Unexpected content type: ${contentType}`);
    }
  }

  async sendNotificationStreamableHTTP(method, params = {}) {
    const notification = {
      jsonrpc: '2.0',
      method: method,
      ...(params !== undefined && Object.keys(params).length > 0 && { params: params })
    };

    const headers = HTTPClient.buildMCPHeaders(this.sessionId, method, 'application/json, text/event-stream');
    await HTTPClient.post(this.serverUrl, notification, headers);
    return { success: true };
  }

  async handleSSEResponse(response) {
    return await HTTPClient.parseSSEResponse(response);
  }

  async connect() {
    try {
      console.log('🔗 Connecting to MCP server:', this.serverUrl);

      if (this.transport === 'auto') {
        this.transport = await this.detectTransport();
        console.log(`🔍 Detected transport: ${this.transport}`);
      }

      if (this.transport === 'sse-legacy') {
        await this.connectSSELegacy();
        console.log('✅ SSE Legacy connection established');
      } else {
        console.log('✅ Using Streamable HTTP transport');
      }

      // Initialize
      const initResult = await this.sendMessage('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        clientInfo: { name: 'llm-chat-interface', version: '1.0.0' }
      });

      if (initResult.error) throw new Error(`Initialize error: ${initResult.error.message}`);

      if (initResult.result && initResult.result.sessionId) {
        this.sessionId = initResult.result.sessionId;
      }

      await this.sendNotification('notifications/initialized');

      const toolsResult = await this.sendMessage('tools/list');
      if (toolsResult.error) throw new Error(`Tools list error: ${toolsResult.error.message}`);

      this.tools = toolsResult.result.tools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema || { type: 'object', properties: {}, required: [] }
        },
        _mcpTool: true
      }));

      this.connected = true;
      return { success: true, tools: this.tools, transport: this.transport };
    } catch (error) {
      console.error('❌ Connection failed:', error);
      this.connected = false;
      return { success: false, error: error.message };
    }
  }

  async callTool(toolName, args) {
    if (!this.connected) throw new Error('Not connected to MCP server');

    try {
      const result = await this.sendMessage('tools/call', {
        name: toolName,
        arguments: args || {}
      });

      if (result.error) throw new Error(`Tool call error: ${result.error.message}`);

      let content = result.result.content;
      if (Array.isArray(content)) {
        content = content.map(item => item.text || item.content || JSON.stringify(item)).join(' ');
      } else if (typeof content === 'object') {
        content = JSON.stringify(content);
      }

      return {
        content: content.toString(),
        tool_call_id: `mcp_${toolName}_${Date.now()}`
      };
    } catch (error) {
      console.error(`Failed to call tool ${toolName}:`, error);
      throw error;
    }
  }

  disconnect() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.messageEndpoint = null;
    this.pendingRequests.clear();
    this.connected = false;
    this.tools = [];
    this.sessionId = null;
    console.log('✅ MCP client disconnected');
  }
}
