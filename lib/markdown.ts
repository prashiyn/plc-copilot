function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatInline(text: string): string {
  let out = text;
  out = out.replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 rounded text-sm font-mono">$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    '<a href="$2" class="text-blue-600 hover:text-blue-800 underline" target="_blank" rel="noopener noreferrer">$1</a>',
  );
  return out;
}

function formatBlocks(source: string): string {
  const lines = source.split('\n');
  const parts: string[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let inCode = false;
  let codeLines: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    parts.push(`<p class="mb-2 last:mb-0">${formatInline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (listItems.length === 0) return;
    parts.push(
      `<ul class="list-disc pl-5 mb-2 space-y-1">${listItems
        .map((item) => `<li>${formatInline(item)}</li>`)
        .join('')}</ul>`,
    );
    listItems = [];
  };

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (inCode) {
        parts.push(
          `<pre class="bg-gray-100 rounded-lg p-3 text-sm font-mono overflow-x-auto mb-2"><code>${codeLines.join('\n')}</code></pre>`,
        );
        codeLines = [];
        inCode = false;
      } else {
        flushParagraph();
        flushList();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeLines.push(escapeHtml(line));
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      const cls =
        level === 1
          ? 'text-lg font-bold mt-3 mb-2'
          : level === 2
            ? 'text-base font-semibold mt-3 mb-1'
            : 'text-sm font-semibold mt-2 mb-1';
      parts.push(`<h${level} class="${cls}">${formatInline(heading[2])}</h${level}>`);
      continue;
    }

    const listMatch = line.match(/^\s*[-*]\s+(.+)$/);
    if (listMatch) {
      flushParagraph();
      listItems.push(listMatch[1]);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }

  if (inCode && codeLines.length > 0) {
    parts.push(
      `<pre class="bg-gray-100 rounded-lg p-3 text-sm font-mono overflow-x-auto mb-2"><code>${codeLines.join('\n')}</code></pre>`,
    );
  }
  flushParagraph();
  flushList();

  return parts.join('');
}

/** Render a safe HTML subset from markdown-style note text. */
export function renderMarkdown(source: string): string {
  if (!source.trim()) return '';
  return formatBlocks(escapeHtml(source));
}
