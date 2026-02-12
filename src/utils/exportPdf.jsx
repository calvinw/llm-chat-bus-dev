import MarkdownIt from 'markdown-it';
import { exportConversationAsMarkdown } from './exportMarkdown';
import { preprocessMarkdownForMath } from './mathProcessor';

/**
 * Attempt to clone the iframe's body HTML and stylesheets (same-origin only).
 * Returns { html, styles } or null for cross-origin iframes.
 */
function captureIframeContent(iframeEl) {
  if (!iframeEl) return null;
  try {
    const doc = iframeEl.contentWindow?.document;
    if (!doc || !doc.body) return null;

    const html = doc.body.innerHTML;

    // Collect stylesheet text
    let styles = '';
    for (const sheet of doc.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          styles += rule.cssText + '\n';
        }
      } catch {
        // Cross-origin stylesheet — skip
      }
    }

    // Also grab inline <style> tags
    for (const styleEl of doc.querySelectorAll('style')) {
      styles += styleEl.textContent + '\n';
    }

    return { html, styles };
  } catch {
    // Cross-origin — cannot access iframe DOM
    return null;
  }
}

/**
 * Convert a markdown string to HTML using markdown-it.
 * Protects LaTeX math expressions from markdown corruption using placeholders,
 * then restores them so KaTeX auto-render can process them in the print window.
 */
function renderMarkdownToHtml(markdownString) {
  const { content, restoreMath } = preprocessMarkdownForMath(markdownString);
  const md = new MarkdownIt({ html: true, linkify: true, typographer: true });
  const html = md.render(content);
  const restored = restoreMath(html);
  // Convert escaped \$ (literal dollar signs) to plain $
  return restored.replace(/\\\$/g, '$');
}

/**
 * Build a complete print-friendly HTML document.
 */
function composePrintDocument(iframeHtml, iframeStyles, conversationHtml) {
  const iframeSection = iframeHtml
    ? `
      <section class="iframe-section">
        <h1>Financial Comparison</h1>
        <style>${iframeStyles || ''}</style>
        <div class="iframe-content">${iframeHtml}</div>
      </section>
      <div class="page-break"></div>
    `
    : `
      <section class="iframe-section">
        <h1>Financial Comparison</h1>
        <p class="fallback-note">Iframe content not available (cross-origin). Open in production for full capture.</p>
      </section>
      <div class="page-break"></div>
    `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>FIT Retail Index Chat — Export</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css">
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/contrib/auto-render.min.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      max-width: 900px;
      margin: 0 auto;
      padding: 24px;
      color: #1a1a1a;
      line-height: 1.6;
    }

    h1 { font-size: 1.5rem; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 16px; }
    h2 { font-size: 1.25rem; margin-top: 24px; margin-bottom: 8px; color: #111827; }
    h3 { font-size: 1rem; margin-top: 16px; margin-bottom: 6px; color: #1f2937; }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
      font-size: 0.85rem;
    }
    th, td {
      border: 1px solid #d1d5db;
      padding: 6px 10px;
      text-align: left;
    }
    th { background: #f3f4f6; font-weight: 600; }

    pre {
      background: #f3f4f6;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 12px;
      overflow-x: auto;
      font-size: 0.8rem;
    }
    code {
      background: #f3f4f6;
      padding: 1px 4px;
      border-radius: 3px;
      font-size: 0.85em;
    }
    pre code { background: none; padding: 0; }

    .page-break { page-break-after: always; }

    .iframe-section { margin-bottom: 24px; }
    .iframe-content { overflow: visible; }

    .fallback-note {
      color: #9ca3af;
      font-style: italic;
      padding: 16px;
      border: 1px dashed #d1d5db;
      border-radius: 6px;
      text-align: center;
    }

    .conversation-section { margin-top: 24px; }

    @media print {
      body { padding: 0; max-width: none; }
      .page-break { page-break-after: always; }
    }
  </style>
</head>
<body>
  ${iframeSection}
  <section class="conversation-section">
    <h1>Chat Conversation</h1>
    ${conversationHtml}
  </section>
</body>
</html>`;
}

/**
 * Main entry point: capture iframe + render chat, open print window.
 */
export function printConversationWithTable(iframeEl, messages) {
  // Generate markdown from the conversation, stripping tool call lines
  const md = exportConversationAsMarkdown(messages, { compact: true })
    .replace(/^\*\[tool:.*\]\*\n*/gm, '');
  const conversationHtml = renderMarkdownToHtml(md);

  // Try to capture iframe content
  const iframeCapture = captureIframeContent(iframeEl);
  const iframeHtml = iframeCapture?.html ?? null;
  const iframeStyles = iframeCapture?.styles ?? '';

  // Compose the full document
  const doc = composePrintDocument(iframeHtml, iframeStyles, conversationHtml);

  // Open new window and print
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    console.error('Failed to open print window — popup may be blocked');
    return;
  }
  printWindow.document.write(doc);
  printWindow.document.close();
  printWindow.addEventListener('load', () => {
    // Render math with KaTeX auto-render, then print
    const tryRender = () => {
      if (printWindow.renderMathInElement) {
        printWindow.renderMathInElement(printWindow.document.body, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '\\[', right: '\\]', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\(', right: '\\)', display: false },
          ],
          throwOnError: false,
        });
        printWindow.print();
      } else {
        // auto-render script is deferred — wait for it
        setTimeout(tryRender, 50);
      }
    };
    tryRender();
  });
}
