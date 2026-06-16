import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('escapes raw HTML', () => {
    const html = renderMarkdown('<script>alert(1)</script>');
    assert.doesNotMatch(html, /<script>/);
    assert.match(html, /&lt;script&gt;/);
  });

  it('renders bold, italic, and inline code', () => {
    const html = renderMarkdown('**bold** and *italic* with `code`');
    assert.match(html, /<strong>bold<\/strong>/);
    assert.match(html, /<em>italic<\/em>/);
    assert.match(html, /<code[^>]*>code<\/code>/);
  });

  it('renders headings and lists', () => {
    const html = renderMarkdown('## Title\n\n- one\n- two');
    assert.match(html, /<h2[^>]*>Title<\/h2>/);
    assert.match(html, /<ul/);
    assert.match(html, /<li>one<\/li>/);
  });

  it('renders safe links only for http(s)', () => {
    const html = renderMarkdown('[Docs](https://example.com)');
    assert.match(html, /href="https:\/\/example.com"/);
    assert.doesNotMatch(renderMarkdown('[Bad](javascript:alert(1))'), /href="javascript:/);
  });

  it('renders fenced code blocks', () => {
    const html = renderMarkdown('```\nMOV A\n```');
    assert.match(html, /<pre[^>]*><code>MOV A<\/code><\/pre>/);
  });
});
