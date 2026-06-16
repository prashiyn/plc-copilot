import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MAX_UPLOAD_BYTES } from './storage';
import { validateCoverImageUpload, validateProjectUpload } from './project-upload';

describe('validateProjectUpload', () => {
  it('rejects files over 50 MB', () => {
    const result = validateProjectUpload({
      name: 'big.zip',
      size: MAX_UPLOAD_BYTES + 1,
      type: 'application/zip',
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 413);
  });

  it('rejects disallowed MIME types', () => {
    const result = validateProjectUpload({
      name: 'malware.exe',
      size: 100,
      type: 'application/octet-stream',
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 415);
  });

  it('accepts allowed uploads', () => {
    const result = validateProjectUpload({
      name: 'diagram.png',
      size: 1024,
      type: 'image/png',
    });
    assert.equal(result.ok, true);
  });
});

describe('validateCoverImageUpload', () => {
  it('rejects non-image cover files', () => {
    const result = validateCoverImageUpload({
      name: 'manual.pdf',
      size: 1024,
      type: 'application/pdf',
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 415);
  });

  it('accepts image cover files', () => {
    const result = validateCoverImageUpload({
      name: 'cover.jpg',
      size: 2048,
      type: 'image/jpeg',
    });
    assert.equal(result.ok, true);
  });
});
