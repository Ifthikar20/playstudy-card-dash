/**
 * Mermaid Diagram Renderer Component
 *
 * Renders Mermaid.js diagrams for educational content visualization
 */
import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

interface MermaidDiagramProps {
  code: string;
  className?: string;
}

// Initialize mermaid once
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  suppressErrors: true, // Suppress internal errors, we'll handle them
});

/**
 * Clean and validate Mermaid code
 * Fixes common syntax issues
 */
function cleanMermaidCode(code: string): string {
  // Remove extra whitespace and normalize line endings
  let cleaned = code.trim().replace(/\r\n/g, '\n');

  // Fix common syntax issues in mindmaps
  // Remove invalid ::: syntax that's not properly formatted
  cleaned = cleaned.replace(/:::\s*(\w+)\s*:/g, ':::$1');

  // Ensure proper spacing around operators
  cleaned = cleaned.replace(/\s{2,}/g, ' ');

  return cleaned;
}

export function MermaidDiagram({ code, className = '' }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(true);

  useEffect(() => {
    if (!code || !containerRef.current) return;

    const renderDiagram = async () => {
      try {
        setIsRendering(true);
        setError(null);

        // Clean the code before rendering
        const cleanedCode = cleanMermaidCode(code);

        // Generate unique ID for this diagram
        const id = `mermaid-${Math.random().toString(36).substring(7)}`;

        // Render the diagram
        const { svg } = await mermaid.render(id, cleanedCode);

        // Insert SVG into container
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch (err) {
        console.error('Mermaid rendering error:', err);

        // Extract meaningful error message
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';

        // Check for common syntax errors
        if (errorMessage.includes('Parse error')) {
          setError('Diagram syntax error - AI generated invalid diagram code');
        } else if (errorMessage.includes('SPACELIST')) {
          setError('Diagram formatting issue - improper spacing detected');
        } else {
          setError('Failed to render diagram');
        }

        // Log the problematic code for debugging
        console.error('Problematic Mermaid code:', code);
      } finally {
        setIsRendering(false);
      }
    };

    renderDiagram();
  }, [code]);

  if (error) {
    // Don't show anything when diagram fails - just hide it completely
    return null;
  }

  return (
    <div className={`relative ${className}`}>
      {isRendering && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}
      <div
        ref={containerRef}
        className="flex items-center justify-center p-4 bg-muted/30 rounded-lg border border-border overflow-auto"
      />
    </div>
  );
}
