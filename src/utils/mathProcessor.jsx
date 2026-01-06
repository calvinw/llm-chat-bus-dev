import MarkdownIt from 'markdown-it';
import { codeToHtml } from 'shiki';

/**
 * Math processing utilities for LaTeX expressions in markdown
 * Protects math expressions from markdown processing corruption
 */

/**
 * Protects LaTeX math expressions from markdown processing corruption
 * Replaces math expressions with placeholders, then restores them after markdown processing
 * @param {string} markdown - Raw markdown text with potential math expressions
 * @returns {Object} - Object with processed content and restore function
 */
export function preprocessMarkdownForMath(markdown) {
  const mathParts = [];
  const escapedParts = [];
  let counter = 0;
  let escapedCounter = 0;
  
  // Step 0: First, protect escaped dollars by replacing them with placeholders
  let processed = markdown.replace(/\\\$/g, () => {
    const placeholder = `XESCAPEDDOLLARX${escapedCounter}X`;
    escapedParts[escapedCounter] = '\\$';
    escapedCounter++;
    return placeholder;
  });
  
  // Step 1: Replace display math $$...$$ with placeholders FIRST (order matters!)
  processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (match, content) => {
    const placeholder = `XMATHPLACEHOLDERX${counter}XDISPLAYXMATH`;
    mathParts[counter] = match;
    counter++;
    return placeholder;
  });
  
  // Step 2: Replace display math \[...\] with placeholders
  processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (match, content) => {
    const placeholder = `XMATHPLACEHOLDERX${counter}XDISPLAYXMATH`;
    mathParts[counter] = match;
    counter++;
    return placeholder;
  });
  
  // Step 3: Replace inline math $...$ with placeholders (escaped $ already protected)
  processed = processed.replace(/\$([^$\n]*?)\$/g, (match, content) => {
    const placeholder = `XMATHPLACEHOLDERX${counter}XINLINEXMATH`;
    mathParts[counter] = match;
    counter++;
    return placeholder;
  });
  
  // Step 4: Replace inline math \(...\) with placeholders
  processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (match, content) => {
    const placeholder = `XMATHPLACEHOLDERX${counter}XINLINEXMATH`;
    mathParts[counter] = match;
    counter++;
    return placeholder;
  });
  
  // Step 5: No need to escape \$ anymore since we handled it in Step 0
  
  return {
    content: processed,
    restoreMath: function(htmlString) {
      let restored = htmlString;
      
      // First restore math expressions
      for (let i = 0; i < counter; i++) {
        const displayPlaceholder = `XMATHPLACEHOLDERX${i}XDISPLAYXMATH`;
        const inlinePlaceholder = `XMATHPLACEHOLDERX${i}XINLINEXMATH`;
        
        // Use string replacement instead of regex to avoid $ interpretation issues
        if (restored.includes(displayPlaceholder)) {
          restored = restored.split(displayPlaceholder).join(mathParts[i]);
        }
        if (restored.includes(inlinePlaceholder)) {
          restored = restored.split(inlinePlaceholder).join(mathParts[i]);
        }
      }
      
      // Then restore escaped dollars
      for (let i = 0; i < escapedCounter; i++) {
        const escapedPlaceholder = `XESCAPEDDOLLARX${i}X`;
        if (restored.includes(escapedPlaceholder)) {
          restored = restored.split(escapedPlaceholder).join(escapedParts[i]);
        }
      }
      
      return restored;
    }
  };
}


/**
 * Escape HTML entities in text to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
 export function escapeHtml(text) {  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Process plain text content for display
 * @param {string} content - Raw text content
 * @returns {string} - HTML-safe content with line breaks
 */
export function renderPlainText(content) {
  return escapeHtml(content).replace(/\n/g, '<br>');
}

/**
 * Initialize markdown-it renderer with safe settings
 * Uses global markdownit from CDN
 * @returns {Object} - Configured markdown-it instance
 */
export function createMarkdownRenderer() {
  try {
    const md = new MarkdownIt({
      html: true,
      breaks: true,
      linkify: true,
      typographer: true,
      highlight: (str, lang) => {
        if (lang) {
          try {
            return codeToHtml(str, { lang, theme: 'github-dark' });
          } catch (e) {
            console.error(e);
          }
        }
        // Fallback for no language
        return `<pre><code class="language-text">${md.utils.escapeHtml(str)}</code></pre>`;
      }
    });

    md.enable(['table']);

    // Customize table rendering to wrap in scrollable container and ensure full width
    md.renderer.rules.table_open = (tokens, idx, options, env, self) => {
      return '<div class="w-full overflow-x-auto my-4">\n<table class="w-full text-left border-collapse">';
    };
    
    md.renderer.rules.table_close = (tokens, idx, options, env, self) => {
      return '</table>\n</div>';
    };

    return md;
  } catch (error) {
    console.warn('Failed to initialize markdown-it:', error);
    // Fallback if markdown-it initialization fails
    return {
      render: (text) => {
        console.warn('markdown-it not available, falling back to plain text');
        return renderPlainText(text);
      }
    };
  }
}

export default {
  preprocessMarkdownForMath,
  escapeHtml,
  renderPlainText,
  createMarkdownRenderer
};