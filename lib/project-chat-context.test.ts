import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildProjectContextBlock,
  prependProjectContext,
} from './project-chat-context';

describe('project chat context', () => {
  it('builds a project context block', () => {
    const block = buildProjectContextBlock({
      name: 'Bottling Line Phase 2',
      plcManufacturer: 'Siemens',
      plcModel: 'S7-1200',
      industry: 'Food & Beverage',
    });
    assert.match(block, /Project: "Bottling Line Phase 2"/);
    assert.match(block, /PLC: Siemens S7-1200/);
    assert.match(block, /Industry: Food & Beverage/);
  });

  it('prepends project context once', () => {
    const messages = [{ sender: 'user', content: 'Help me tune PID' }];
    const withContext = prependProjectContext(messages, 'Project: "Demo"');
    assert.equal(withContext.length, 2);
    assert.match(withContext[0].content, /Project context:/);
    const again = prependProjectContext(withContext, 'Project: "Demo"');
    assert.equal(again.length, 2);
  });
});
