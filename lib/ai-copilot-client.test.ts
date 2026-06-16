import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const BFF_AI_ROUTES = [
  'app/api/ai-chat/route.ts',
  'app/api/ai-engineer-chat/route.ts',
  'app/api/ai-generate-application/route.ts',
  'app/api/ai-library-search/route.ts',
  'app/api/ai-optimize-code/route.ts',
];

describe('BFF AI routes are prompt-free', () => {
  for (const routePath of BFF_AI_ROUTES) {
    it(`${routePath} does not embed SYSTEM_PROMPT`, () => {
      const source = readFileSync(routePath, 'utf-8');
      assert.doesNotMatch(source, /SYSTEM_PROMPT/);
      assert.doesNotMatch(source, /ENGINEER_PERSONAS/);
      assert.doesNotMatch(source, /aiJson\(/);
      assert.doesNotMatch(source, /aiChat\(/);
    });
  }
});

describe('automation-client AI feature endpoints', () => {
  it('exports Python-owned prompt routes', async () => {
    const client = await import('./automation-client');
    assert.equal(typeof client.copilotChat, 'function');
    assert.equal(typeof client.engineerChat, 'function');
    assert.equal(typeof client.generateApplication, 'function');
    assert.equal(typeof client.librarySearch, 'function');
    assert.equal(typeof client.optimizeCode, 'function');
  });
});
