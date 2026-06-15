import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSketchGenerateResponse } from './sketch-generate-response';

describe('buildSketchGenerateResponse', () => {
  const generated = {
    content: Buffer.from('test-smbp-bytes'),
    fileName: 'Motor.smbp',
    mimeType: 'application/xml',
    metadata: { source: 'sketch_analysis', sketchConfidence: 0.9 },
    ir: { name: 'Motor', target: { vendor: 'schneider', model: 'TM221CE24R' } },
  };

  it('returns binary attachment when includeMetadata is false', () => {
    const result = buildSketchGenerateResponse(generated, false);
    assert.equal(result.kind, 'binary');
    if (result.kind !== 'binary') return;
    assert.equal(Buffer.from(result.content).toString(), 'test-smbp-bytes');
    assert.equal(result.headers['Content-Type'], 'application/xml');
    assert.match(result.headers['Content-Disposition'], /Motor\.smbp/);
  });

  it('returns JSON with metadata and ir when includeMetadata is true', () => {
    const result = buildSketchGenerateResponse(generated, true);
    assert.equal(result.kind, 'json');
    if (result.kind !== 'json') return;
    assert.equal(result.body.success, true);
    assert.equal(result.body.fileName, 'Motor.smbp');
    assert.equal(result.body.contentBase64, Buffer.from('test-smbp-bytes').toString('base64'));
    assert.equal(result.body.metadata?.source, 'sketch_analysis');
    assert.equal(result.body.ir?.name, 'Motor');
  });
});
