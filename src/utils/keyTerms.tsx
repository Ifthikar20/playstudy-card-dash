/**
 * Utility functions for parsing and highlighting key terms in mentor content
 */

/**
 * Parse narrative text and extract/highlight key terms
 * @param text - Raw narrative with **TERM:word** markers
 * @returns Object with highlighted JSX and key terms list
 */
export function parseKeyTerms(text: string): {
  highlightedText: React.ReactNode[];
  keyTerms: string[];
} {
  const keyTerms: string[] = [];
  const termPattern = /\*\*TERM:(.*?)\*\*/g;

  // Extract all key terms first
  let match;
  while ((match = termPattern.exec(text)) !== null) {
    if (!keyTerms.includes(match[1])) {
      keyTerms.push(match[1]);
    }
  }

  // Split text and highlight terms
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  // Reset regex
  termPattern.lastIndex = 0;

  while ((match = termPattern.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    // Add highlighted term with ID for navigation
    const termId = `keyterm-${match[1].toLowerCase().replace(/\s+/g, '-')}`;
    parts.push(
      <span
        key={`term-${match.index}`}
        id={termId}
        className="font-semibold text-primary bg-primary/10 px-1 rounded scroll-mt-24"
        title="Key term"
      >
        {match[1]}
      </span>
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return { highlightedText: parts, keyTerms };
}

/**
 * Progressive text reveal with key term highlighting
 * Shows text word by word with highlighted key terms
 */
export function parseProgressiveKeyTerms(
  fullText: string,
  wordsToShow: number
): React.ReactNode[] {
  // First, extract the term positions from full text
  const termPattern = /\*\*TERM:(.*?)\*\*/g;
  const termPositions: Array<{ start: number; end: number; term: string }> = [];

  let match;
  while ((match = termPattern.exec(fullText)) !== null) {
    termPositions.push({
      start: match.index,
      end: match.index + match[0].length,
      term: match[1],
    });
  }

  // Get visible portion of text
  const words = fullText.split(' ');
  const visibleText = words.slice(0, wordsToShow).join(' ');

  // Check which terms fall within visible range
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  for (const termPos of termPositions) {
    // Only process if term is within visible text
    if (termPos.start >= visibleText.length) break;

    const termEnd = Math.min(termPos.end, visibleText.length);

    // Add text before term
    if (termPos.start > lastIndex) {
      parts.push(visibleText.substring(lastIndex, termPos.start));
    }

    // Extract term content from visible text
    const termMatch = visibleText.substring(termPos.start, termEnd);
    const termContent = termMatch.match(/\*\*TERM:(.*?)(\*\*)?$/)?.[1] || termPos.term;

    // Add highlighted term
    parts.push(
      <span
        key={`term-${termPos.start}`}
        className="font-semibold text-primary bg-primary/10 px-1 rounded animate-pulse"
      >
        {termContent}
      </span>
    );

    lastIndex = termEnd;
  }

  // Add remaining visible text
  if (lastIndex < visibleText.length) {
    parts.push(visibleText.substring(lastIndex));
  }

  return parts;
}
