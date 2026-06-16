import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { describe, it } from 'node:test';
import {
  MAX_UPLOAD_BYTES,
  deleteFile,
  isAllowedUpload,
  resolveUploadMimeType,
  sanitizeFilename,
  storagePathFromUrl,
  writeFile,
} from './storage';

describe('storage helpers', () => {
  it('enforces 50 MB upload limit constant', () => {
    assert.equal(MAX_UPLOAD_BYTES, 50 * 1024 * 1024);
  });

  it('sanitizes unsafe filenames', () => {
    assert.equal(sanitizeFilename('../../etc/passwd'), 'passwd');
    assert.equal(sanitizeFilename('wiring diagram.png'), 'wiring diagram.png');
    assert.equal(sanitizeFilename('bad/name?.png'), 'name_.png');
  });

  it('allows images, pdf, csv, xml, json, zip', () => {
    assert.equal(isAllowedUpload('diagram.png', 'image/png'), true);
    assert.equal(isAllowedUpload('manual.pdf', 'application/pdf'), true);
    assert.equal(isAllowedUpload('tags.csv', 'text/csv'), true);
    assert.equal(isAllowedUpload('config.xml', 'application/xml'), true);
    assert.equal(isAllowedUpload('data.json', 'application/json'), true);
    assert.equal(isAllowedUpload('bundle.zip', 'application/zip'), true);
  });

  it('rejects disallowed file types', () => {
    assert.equal(isAllowedUpload('virus.exe', 'application/x-msdownload'), false);
    assert.equal(isAllowedUpload('script.sh', 'application/x-sh'), false);
  });

  it('resolves mime type from extension when browser sends octet-stream', () => {
    assert.equal(resolveUploadMimeType('diagram.png', 'application/octet-stream'), 'image/png');
    assert.equal(resolveUploadMimeType('report.pdf', ''), 'application/pdf');
  });

  it('maps storage URLs only under /uploads/', () => {
    assert.ok(storagePathFromUrl('/uploads/projects/abc/file.png')?.endsWith('public/uploads/projects/abc/file.png'));
    assert.equal(storagePathFromUrl('/etc/passwd'), null);
  });
});

describe('storage write/delete roundtrip', () => {
  it('writes and deletes a project file on disk', async () => {
    const projectId = 'test-project-phase-c';
    const storageUrl = await writeFile(projectId, 'sample.png', Buffer.from('png-bytes'));
    assert.match(storageUrl, /^\/uploads\/projects\/test-project-phase-c\/.+-sample\.png$/);

    const diskPath = storagePathFromUrl(storageUrl);
    assert.ok(diskPath);
    await access(diskPath);

    await deleteFile(storageUrl);
    await assert.rejects(access(diskPath));
  });
});
