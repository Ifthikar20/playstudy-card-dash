/**
 * HTML Sanitizer Utility
 * 
 * Lightweight DOM-based HTML sanitizer to prevent XSS attacks
 * when rendering user-uploaded document content.
 * 
 * Uses the browser's built-in DOMParser for safe HTML parsing
 * and a whitelist approach for allowed tags and attributes.
 */

const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'em', 'b', 'i', 'u', 's',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
  'span', 'div', 'section', 'article',
  'blockquote', 'pre', 'code',
  'a', 'img', 'mark', 'sub', 'sup',
  'dl', 'dt', 'dd', 'figure', 'figcaption', 'hr',
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  'a': new Set(['href', 'target', 'rel', 'title']),
  'img': new Set(['src', 'alt', 'width', 'height', 'title']),
  '*': new Set(['class', 'style', 'id']),
};

// Dangerous URL schemes that should be blocked
const DANGEROUS_PROTOCOLS = /^(javascript|data|vbscript):/i;

/**
 * Recursively sanitize a DOM node and its children
 */
function sanitizeNode(node: Node, parent: Node): void {
  const childNodes = Array.from(node.childNodes);
  
  for (const child of childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      // Text nodes are safe
      continue;
    }
    
    if (child.nodeType === Node.COMMENT_NODE) {
      // Remove HTML comments (can contain conditional IE exploits)
      node.removeChild(child);
      continue;
    }
    
    if (child.nodeType === Node.ELEMENT_NODE) {
      const element = child as Element;
      const tagName = element.tagName.toLowerCase();
      
      if (!ALLOWED_TAGS.has(tagName)) {
        // Replace disallowed element with its text content
        const textNode = document.createTextNode(element.textContent || '');
        node.replaceChild(textNode, child);
        continue;
      }
      
      // Sanitize attributes
      const attrs = Array.from(element.attributes);
      for (const attr of attrs) {
        const attrName = attr.name.toLowerCase();
        const tagAllowed = ALLOWED_ATTRS[tagName];
        const globalAllowed = ALLOWED_ATTRS['*'];
        
        if (
          !(tagAllowed?.has(attrName) || globalAllowed?.has(attrName))
        ) {
          element.removeAttribute(attr.name);
          continue;
        }
        
        // Block dangerous URLs in href/src
        if ((attrName === 'href' || attrName === 'src') && DANGEROUS_PROTOCOLS.test(attr.value.trim())) {
          element.removeAttribute(attr.name);
          continue;
        }
        
        // Sanitize style attribute — remove expressions/urls that could execute JS
        if (attrName === 'style') {
          const cleanStyle = attr.value
            .replace(/expression\s*\(/gi, '')
            .replace(/javascript\s*:/gi, '')
            .replace(/url\s*\(\s*['"]?\s*javascript/gi, '');
          element.setAttribute('style', cleanStyle);
        }
      }
      
      // Force safe link attributes
      if (tagName === 'a') {
        element.setAttribute('rel', 'noopener noreferrer');
        element.setAttribute('target', '_blank');
      }
      
      // Recursively sanitize children
      sanitizeNode(element, node);
    }
  }
}

/**
 * Sanitize an HTML string and return safe HTML
 * 
 * @param dirtyHTML - The potentially unsafe HTML string
 * @returns Sanitized HTML string safe for dangerouslySetInnerHTML
 */
export function sanitizeHTML(dirtyHTML: string): string {
  if (!dirtyHTML) return '';
  
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(dirtyHTML, 'text/html');
    
    // Remove all <script> tags
    const scripts = doc.querySelectorAll('script');
    scripts.forEach(s => s.remove());
    
    // Remove all <style> tags (can contain CSS injection)
    const styles = doc.querySelectorAll('style');
    styles.forEach(s => s.remove());
    
    // Remove event handler attributes from all elements
    const allElements = doc.querySelectorAll('*');
    allElements.forEach(el => {
      const attrs = Array.from(el.attributes);
      for (const attr of attrs) {
        if (attr.name.startsWith('on')) {
          el.removeAttribute(attr.name);
        }
      }
    });
    
    // Recursively sanitize the body
    sanitizeNode(doc.body, doc.body);
    
    return doc.body.innerHTML;
  } catch {
    // If parsing fails, escape the entire string
    const div = document.createElement('div');
    div.textContent = dirtyHTML;
    return div.innerHTML;
  }
}
