import { useMemo, useCallback } from 'react';
/**
 * Custom hook for rendering markdown content with math support
 * Handles both markdown and plain text display modes
 */

import { 
  preprocessMarkdownForMath, 
  renderPlainText,
  createMarkdownRenderer 
} from '../utils/mathProcessor.jsx';

const useMarkdownRenderer = (displayMode = 'markdown') => {
  // Create markdown renderer instance (memoized)
  const markdownRenderer = useMemo(() => {
    return createMarkdownRenderer();
  }, []);

  // Memoized function to render message content
  const renderMessage = useCallback((content, role = 'assistant') => {
    if (!content) return '';

    if (displayMode === 'text') {
      // Plain text mode - just escape HTML and convert line breaks
      return renderPlainText(content);
    }

    // Markdown mode with math support
    try {
      // Step 1: Render markdown to HTML first
      let htmlContent = markdownRenderer.render(content);

      // Step 2: Preprocess to protect math expressions from the HTML
      const { content: processedContent, restoreMath } = preprocessMarkdownForMath(htmlContent);
      
      // Step 3: Only remove wrapping paragraph tags if content is simple inline text
      // Keep paragraph tags for complex content with tables, headers, etc.
      if (!processedContent.includes('<table>') && !processedContent.includes('<h1>') && 
          !processedContent.includes('<h2>') && !processedContent.includes('<h3>') &&
          !processedContent.includes('<h4>') && !processedContent.includes('<h5>') &&
          !processedContent.includes('<h6>') && !processedContent.includes('<ul>') &&
          !processedContent.includes('<ol>') && !processedContent.includes('<blockquote>')) {
        htmlContent = processedContent.replace(/^<p>/, '').replace(/<\/p>\s*$/, '');
      } else {
        htmlContent = processedContent;
      }
      
      // Step 4: Restore math expressions
      const finalContent = restoreMath(htmlContent);
      
      return finalContent;
    } catch (error) {
      console.error('Error rendering markdown for content:', content.substring(0, 100) + '...');
      console.error('Markdown error details:', error);
      console.error('Error stack:', error.stack);
      
      // Try to render without math processing as a fallback
      try {
        console.warn('Attempting fallback: rendering without math processing...');
        let htmlContent = markdownRenderer.render(content);
        // Only remove wrapping paragraph tags if content is simple inline text
        if (!htmlContent.includes('<table>') && !htmlContent.includes('<h1>') && 
            !htmlContent.includes('<h2>') && !htmlContent.includes('<h3>') &&
            !htmlContent.includes('<h4>') && !htmlContent.includes('<h5>') &&
            !htmlContent.includes('<h6>') && !htmlContent.includes('<ul>') &&
            !htmlContent.includes('<ol>') && !htmlContent.includes('<blockquote>')) {
          htmlContent = htmlContent.replace(/^<p>/, '').replace(/<\/p>\s*$/, '');
        }
        return htmlContent;
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        // Final fallback to plain text
        return renderPlainText(content);
      }
    }
  }, [displayMode, markdownRenderer]);



  return {
    renderMessage,
    displayMode
  };
};

export default useMarkdownRenderer;