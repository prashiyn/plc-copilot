import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

describe('projects API route handlers', () => {
  it('GET /api/projects/[id] returns 401 when unauthenticated', async () => {
    const src = await readFile('app/api/projects/[id]/route.ts', 'utf8');
    assert.match(src, /if \(!user\) return NextResponse\.json\(\{ error: 'Unauthorized' \}, \{ status: 401 \}\)/);
    assert.match(src, /getProject\(user, id\)/);
    assert.match(src, /if \(!project\) return NextResponse\.json\(\{ error: 'Not found\.' \}, \{ status: 404 \}\)/);
  });

  it('POST /api/projects/from-template validates templateId and handles missing template', async () => {
    const src = await readFile('app/api/projects/from-template/route.ts', 'utf8');
    assert.match(src, /createProjectFromTemplate/);
    assert.match(src, /Template not found/);
    assert.match(src, /status: 404/);
    assert.match(src, /status: 201/);
  });

  it('files POST uses shared upload validation helper', async () => {
    const src = await readFile('app/api/projects/[id]/files/route.ts', 'utf8');
    assert.match(src, /validateProjectUpload/);
    assert.match(src, /validation\.status/);
  });
});
