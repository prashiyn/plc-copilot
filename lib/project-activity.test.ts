import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  activityLabelForFileOperation,
  activityLabelForProgram,
  activityLabelForRectification,
  mergeProjectActivity,
} from './project-activity';

describe('project activity helpers', () => {
  it('labels file operations with filename', () => {
    assert.equal(activityLabelForFileOperation('user_upload', 'diagram.png'), 'File uploaded: diagram.png');
    assert.equal(activityLabelForFileOperation('hmi_generate', 'tags.csv'), 'HMI generated: tags.csv');
  });

  it('labels program generation', () => {
    assert.equal(activityLabelForProgram('motor.st', 'st'), 'Program generated: motor.st');
  });

  it('truncates long rectification messages', () => {
    const long = 'x'.repeat(100);
    const label = activityLabelForRectification(long);
    assert.match(label, /…$/);
  });

  it('sorts and limits merged activity', () => {
    const merged = mergeProjectActivity(
      [
        { id: '1', eventType: 'a', label: 'older', detail: null, createdAt: '2026-01-01T00:00:00.000Z' },
        { id: '2', eventType: 'b', label: 'newer', detail: null, createdAt: '2026-06-01T00:00:00.000Z' },
        { id: '3', eventType: 'c', label: 'mid', detail: null, createdAt: '2026-03-01T00:00:00.000Z' },
      ],
      2,
    );
    assert.equal(merged.length, 2);
    assert.equal(merged[0].label, 'newer');
    assert.equal(merged[1].label, 'mid');
  });
});
