import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getLastUserMessage } from './chat-message-utils';

describe('chat message utils', () => {
  it('extracts the last user message', () => {
    const content = getLastUserMessage([
      { sender: 'assistant', content: 'Hello' },
      { sender: 'user', content: 'First question' },
      { sender: 'assistant', content: 'Answer' },
      { role: 'user', content: 'Follow up' },
    ]);
    assert.equal(content, 'Follow up');
  });

  it('returns null when no user message exists', () => {
    assert.equal(getLastUserMessage([{ sender: 'assistant', content: 'Hi' }]), null);
  });
});
