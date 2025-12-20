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
});

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

        // Generate unique ID for this diagram
        const id = `mermaid-${Math.random().toString(36).substring(7)}`;

        // Render the diagram
        const { svg } = await mermaid.render(id, code);

        // Insert SVG into container
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch (err) {
        console.error('Mermaid rendering error:', err);
        setError('Failed to render diagram');
      } finally {
        setIsRendering(false);
      }
    };

    renderDiagram();
  }, [code]);

  if (error) {
    return (
      <div className={`p-4 border border-destructive/50 bg-destructive/10 rounded-lg ${className}`}>
        <p className="text-sm text-destructive">⚠️ {error}</p>
      </div>
    );
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
