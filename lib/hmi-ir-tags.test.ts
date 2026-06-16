import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extractTagsFromProgramIr } from './hmi-ir-tags';

describe('extractTagsFromProgramIr', () => {
  it('maps IR vars to HMI tag rows', () => {
    const tags = extractTagsFromProgramIr({
      vars: [
        { symbol: 'START_BTN', address: '%I0.0', dataType: 'BOOL', kind: 'input', comment: 'Start' },
        { symbol: 'TEMP_PV', address: '%IW10', dataType: 'REAL', kind: 'memory' },
      ],
    });
    assert.equal(tags.length, 2);
    assert.deepEqual(tags[0], {
      name: 'START_BTN',
      address: '%I0.0',
      type: 'BOOL',
      comment: 'Start',
    });
    assert.equal(tags[1].name, 'TEMP_PV');
    assert.equal(tags[1].type, 'REAL');
  });

  it('returns empty list for missing IR', () => {
    assert.deepEqual(extractTagsFromProgramIr(null), []);
    assert.deepEqual(extractTagsFromProgramIr({}), []);
  });
});
