/**
 * Common HTTP client utilities for MCP and API requests
 * Reduces code duplication and provides consistent error handling
 */

export class HTTPClient {
  /**
   * Build common headers for MCP requests
   */
  static buildMCPHeaders(sessionId = null, method = null, acceptTypes = 'application/json') {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': acceptTypes
    };

    // Add session ID headers for authenticated requests
    if (sessionId && method !== 'initialize') {
      headers['X-Session-ID'] = sessionId;
      headers['Session-ID'] = sessionId;
      headers['MCP-Session-ID'] = sessionId;
    }

    return headers;
  }

  /**
   * Make a POST request with consistent error handling
   */
  static async post(url, data, headers = {}, options = {}) {
    const defaultOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      mode: 'cors',
      ...options
    };

    if (data) {
      defaultOptions.body = JSON.stringify(data);
    }

    let response;
    try {
      response = await fetch(url, defaultOptions);
    } catch (networkError) {
      console.error('🌐 Network error:', networkError);
      throw new Error(`Network error: ${networkError.message}. Make sure the server is running and CORS is configured.`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return response;
  }

  /**
   * Make a GET request with consistent error handling
   */
  static async get(url, headers = {}, options = {}) {
    const defaultOptions = {
      method: 'GET',
      headers: {
        ...headers
      },
      mode: 'cors',
      ...options
    };

    let response;
    try {
      response = await fetch(url, defaultOptions);
    } catch (networkError) {
      console.error('🌐 Network error:', networkError);
      throw new Error(`Network error: ${networkError.message}. Make sure the server is running and CORS is configured.`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return response;
  }

  /**
   * Parse Server-Sent Events response
   */
  static async parseSSEResponse(response) {
    const text = await response.text();
    console.log('📡 SSE response:', text);

    // Parse SSE format - look for data lines
    const lines = text.split('\n');
    const messages = [];

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const jsonData = line.substring(6).trim();
          if (jsonData && jsonData !== '[DONE]') {
            const message = JSON.parse(jsonData);
            messages.push(message);
          }
        } catch (e) {
          console.warn('Failed to parse SSE data line:', line, e);
        }
      }
    }

    // Return the first valid message (most common case)
    if (messages.length > 0) {
      console.log('✅ Parsed SSE messages:', messages);
      return messages[0];
    }

    throw new Error('No valid JSON messages found in SSE response');
  }
}