/**
 * Convert a conversation messages array to a markdown string.
 * @param {Array} messages - The messages array
 * @param {Object} options
 * @param {boolean} options.compact - If true, tool calls are shown as a single inline line
 */
export function exportConversationAsMarkdown(messages, { compact = false } = {}) {
  let md = '';

  for (const message of messages) {
    if (message.role === 'user') {
      md += `## User\n\n${message.content}\n\n`;
    } else if (message.role === 'assistant') {
      if (message.content) {
        md += `## Assistant\n\n${message.content}\n\n`;
      }

      if (message.parts) {
        for (const part of message.parts) {
          if (part.type?.startsWith('tool-') && part.input) {
            const toolName = part.type.replace('tool-', '');
            if (compact) {
              md += `*[tool: ${toolName}]*\n\n`;
            } else {
              md += `### Tool Call: ${toolName}\n\n`;
              md += '**Input:**\n```json\n';
              md += JSON.stringify(part.input, null, 2);
              md += '\n```\n\n';
            }
          }
        }
      }
    } else if (message.role === 'tool') {
      if (compact) {
        // Skip tool result messages entirely in compact mode
        continue;
      }

      const toolName = message.name || 'unknown';
      const isError = message.parts?.some(p => p.state === 'output-error');
      const statusLabel = isError ? 'error' : 'success';

      md += `### Tool Result: ${toolName} (${statusLabel})\n\n`;

      if (message.content) {
        md += '**Output:**\n```json\n';
        try {
          const parsed = JSON.parse(message.content);
          md += JSON.stringify(parsed, null, 2);
        } catch {
          md += message.content;
        }
        md += '\n```\n\n';
      }

      if (isError) {
        const errorPart = message.parts?.find(p => p.state === 'output-error');
        if (errorPart?.errorText) {
          md += `**Error:** ${errorPart.errorText}\n\n`;
        }
      }
    }
  }

  return md;
}

/**
 * Download a markdown string as a .md file.
 */
export function downloadMarkdown(markdownString, filename = 'conversation.md') {
  const blob = new Blob([markdownString], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
