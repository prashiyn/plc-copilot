import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildCatalogText } from './ai-recommend';

describe('buildCatalogText', () => {
  it('includes major PLC manufacturers', () => {
    const catalog = buildCatalogText();
    assert.match(catalog, /Schneider Electric/);
    assert.match(catalog, /Siemens/);
    assert.match(catalog, /Allen-Bradley|Rockwell/);
    assert.ok(catalog.split('\n').length >= 100);
  });

  it('formats each line as manufacturer | series | model', () => {
    const firstLine = buildCatalogText().split('\n')[0];
    const parts = firstLine.split(' | ');
    assert.ok(parts.length >= 3);
    assert.ok(parts[0].length > 0);
    assert.ok(parts[2].length > 0);
  });
});
