'use client';

import { renderMarkdown } from '@/lib/markdown';

export default function MarkdownContent({ source }: { source: string }) {
  const html = renderMarkdown(source);
  if (!html) {
    return <p className="text-sm text-gray-400 italic">Empty note</p>;
  }
  return (
    <div
      className="prose-note text-sm text-gray-700 leading-relaxed"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
