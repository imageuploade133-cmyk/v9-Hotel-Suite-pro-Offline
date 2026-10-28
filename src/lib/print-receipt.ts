'use client';

/**
 * Professional print utility that clones already-rendered DOM content.
 *
 * Architecture:
 * 1. Does NOT fetch any data inside print functions
 * 2. Prints only already-rendered DOM content
 * 3. Uses document.getElementById and cloneNode(true) to copy printable content
 * 4. Opens a new print window and injects full HTML with styles
 * 5. Calls print() only after the document is fully written and loaded
 * 6. Separates business logic from printing logic
 *
 * This ensures instant, reliable printing without timing issues.
 */

interface PrintOptions {
  title?: string;
  copies?: number;
  useIframe?: boolean;
}

/**
 * Get all relevant CSS styles from the current document to ensure
 * the printed content looks identical to the screen.
 */
function getDocumentStyles(): string {
  const styleSheets = Array.from(document.styleSheets);
  let styles = '';

  try {
    for (const sheet of styleSheets) {
      try {
        const rules = Array.from(sheet.cssRules || sheet.rules || []);
        for (const rule of rules) {
          styles += rule.cssText + '\n';
        }
      } catch (e) {
        // Skip cross-origin stylesheets
      }
    }
  } catch (e) {
    // Fallback to basic styles if we can't access stylesheets
  }

  // Add essential print styles
  return `
    ${styles}
    @media print {
      @page { margin: 5mm; size: auto; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
      * { box-sizing: border-box; }
    }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: white;
      margin: 0;
      padding: 20px;
      color: black;
    }
    .receipt { font-family: 'Courier New', Courier, monospace; }
  `;
}

/**
 * Print HTML content directly.
 * @param html - The HTML string to print
 * @param options - Print options (title, copies)
 */
export function printHtml(html: string, options: PrintOptions = {}): void {
  const { title = 'Receipt', copies = 1, useIframe = false } = options;

  // Generate multiple copies if needed
  let fullContent = '';
  for (let i = 0; i < copies; i++) {
    fullContent += html;
    if (copies > 1 && i < copies - 1) {
      fullContent += '<div style="page-break-after: always;"></div>';
    }
  }

  const styles = getDocumentStyles();

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <style>${styles}</style>
</head>
<body>
  ${fullContent}
  <script>
    window.onload = function() {
      // Ensure DOM is fully rendered before printing
      setTimeout(function() {
        window.print();
        if (window.parent === window) {
           // Only close if not in an iframe (though window.open uses a new window)
           // window.close();
        }
      }, 100);
    };
  </script>
</body>
</html>`;

  if (useIframe) {
    // Iframe-based printing (Avoids popup blockers)
    let iframe = document.getElementById('print-iframe') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'print-iframe';
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
    }

    const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(htmlContent);
      iframeDoc.close();
    }
    return;
  }

  // Open a new window and write content (Original method)
  const printWindow = window.open('', '_blank', 'width=800,height=900');

  if (!printWindow) {
    console.warn('Failed to open print window. Falling back to iframe printing.');
    // Fallback to iframe if window.open fails
    printHtml(html, { ...options, useIframe: true });
    return;
  }

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();

  // Fallback: if onload doesn't fire reliably, try after a short delay
  setTimeout(() => {
    try {
      if (!printWindow.closed) {
        printWindow.focus();
      }
    } catch (e) {
      console.error('Error focusing print window:', e);
    }
  }, 500);
}

/**
 * Print content from a DOM element by ID.
 * This is the RECOMMENDED way to print - it clones already-rendered content.
 *
 * @param elementId - The ID of the element to print
 * @param options - Print options (title, copies)
 *
 * Usage:
 * 1. Ensure the element has an ID: <div id="receipt-content">...</div>
 * 2. Call: printById('receipt-content', { title: 'My Receipt' })
 */
import { printEscPosBluetooth, isBluetoothSupported } from './bluetooth-printer';

export async function printViaBluetooth(textOrElementId: string): Promise<boolean> {
  if (!isBluetoothSupported()) {
    console.warn('Web Bluetooth is not supported on this browser. Falling back to standard print.');
    printById(textOrElementId);
    return false;
  }
  try {
    const el = document.getElementById(textOrElementId);
    const content = el ? el.innerText : textOrElementId;
    await printEscPosBluetooth(content);
    return true;
  } catch (err) {
    console.warn('Bluetooth print failed or cancelled. Falling back to browser print:', err);
    printById(textOrElementId);
    return false;
  }
}

export function printById(elementId: string, options: PrintOptions = {}): void {
  const { title = 'Receipt', copies = 1 } = options;

  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with ID "${elementId}" not found`);
    return;
  }

  // Clone the element with all its content and styles
  const clonedElement = element.cloneNode(true) as HTMLElement;

  // Remove any interactive elements that shouldn't be printed
  const buttons = clonedElement.querySelectorAll('button, a, input, select, textarea');
  buttons.forEach(btn => btn.remove());

  // Get the inner HTML of the cloned element
  const htmlContent = clonedElement.innerHTML;

  printHtml(htmlContent, { title, copies });
}

/**
 * Print content from a DOM element reference.
 * Use this when you have a ref to the element.
 *
 * @param element - The HTMLElement to print
 * @param options - Print options (title, copies)
 */
export function printElement(element: HTMLElement, options: PrintOptions = {}): void {
  if (!element) {
    console.error('No element provided to print');
    return;
  }

  // Clone the element
  const clonedElement = element.cloneNode(true) as HTMLElement;

  // Remove any interactive elements
  const buttons = clonedElement.querySelectorAll('button, a, input, select, textarea');
  buttons.forEach(btn => btn.remove());

  printHtml(clonedElement.innerHTML, options);
}

/**
 * Legacy function for backward compatibility.
 * @deprecated Use printById or printElement instead
 */
export function printHtmlLegacy(html: string, title = 'Receipt', copies = 1): void {
  printHtml(html, { title, copies });
}
