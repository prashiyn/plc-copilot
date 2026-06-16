/**
 * Phase A tests — project workspace.
 *
 * These are pure unit tests that exercise:
 * 1. New API route files exist (smoke).
 * 2. Query helpers that can run without a real DB (logic tested via mocked modules).
 * 3. Schema shape: new columns and tables exported from lib/db/schema.ts.
 * 4. Workspace page file exists.
 * 5. Note input validation helpers.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { access } from 'node:fs/promises';

// ─── route existence ──────────────────────────────────────────────────────────

describe('Phase A API routes exist', () => {
  const ROUTES = [
    'app/api/projects/[id]/route.ts',
    'app/api/projects/[id]/programs/route.ts',
    'app/api/projects/[id]/files/route.ts',
    'app/api/projects/[id]/notes/route.ts',
    'app/api/projects/[id]/notes/[noteId]/route.ts',
    'app/api/projects/[id]/chats/route.ts',
  ];

  for (const routePath of ROUTES) {
    it(`${routePath} is present`, async () => {
      await access(routePath);
    });
  }
});

describe('Phase A page exists', () => {
  it('app/(features)/projects/[id]/page.tsx is present', async () => {
    await access('app/(features)/projects/[id]/page.tsx');
  });
});

// ─── migration exists ─────────────────────────────────────────────────────────

describe('Phase A migration exists', () => {
  it('0002_project_workspace.sql is present', async () => {
    await access('lib/db/migrations/0002_project_workspace.sql');
  });
});

// ─── schema shape (source-based checks — no DB connection needed) ─────────────

describe('Phase A schema source checks', () => {
  it('schema exports projectNotes and projectChats', async () => {
    const { readFile } = await import('node:fs/promises');
    const src = await readFile('lib/db/schema.ts', 'utf8');
    assert.match(src, /export const projectNotes/, 'projectNotes not exported');
    assert.match(src, /export const projectChats/, 'projectChats not exported');
  });

  it('projects table has new v1.7 columns in schema', async () => {
    const { readFile } = await import('node:fs/promises');
    const src = await readFile('lib/db/schema.ts', 'utf8');
    assert.match(src, /templateId/, 'templateId column missing');
    assert.match(src, /industry/, 'industry column missing');
    assert.match(src, /tags.*jsonb|jsonb.*tags/, 'tags jsonb column missing');
    assert.match(src, /coverImage/, 'coverImage column missing');
  });

  it('projectNotes has projectId, title, body fields', async () => {
    const { readFile } = await import('node:fs/promises');
    const src = await readFile('lib/db/schema.ts', 'utf8');
    assert.match(src, /project_id.*projectNotes|projectNotes[\s\S]{0,300}project_id/m);
    assert.match(src, /title.*varchar|varchar.*title/);
    assert.match(src, /body.*text|text.*body/);
  });
});

// ─── query function exports (source-based) ────────────────────────────────────

describe('Phase A query function source checks', () => {
  const EXPECTED_FUNCTIONS = [
    'getProject',
    'listProjectPrograms',
    'listProjectFiles',
    'listProjectNotes',
    'createProjectNote',
    'updateProjectNote',
    'deleteProjectNote',
    'listProjectChats',
    'linkChatToProject',
  ];

  it('queries.ts exports all new Phase A functions', async () => {
    const { readFile } = await import('node:fs/promises');
    const src = await readFile('lib/db/queries.ts', 'utf8');
    for (const fn of EXPECTED_FUNCTIONS) {
      assert.match(src, new RegExp(`export async function ${fn}`), `Missing: ${fn}`);
    }
  });

  it('ProjectInput interface includes v1.7 fields', async () => {
    const { readFile } = await import('node:fs/promises');
    const src = await readFile('lib/db/queries.ts', 'utf8');
    assert.match(src, /templateId\?/);
    assert.match(src, /industry\?/);
    assert.match(src, /tags\?/);
    assert.match(src, /coverImage\?/);
  });

  it('updateProject passes v1.7 fields to DB', async () => {
    const { readFile } = await import('node:fs/promises');
    const src = await readFile('lib/db/queries.ts', 'utf8');
    assert.match(src, /patch\.industry/);
    assert.match(src, /patch\.tags/);
    assert.match(src, /patch\.coverImage/);
  });
});

// ─── active page has link to workspace ────────────────────────────────────────

describe('Phase A navigation wiring', () => {
  it('active projects page imports Link', async () => {
    const { readFile } = await import('node:fs/promises');
    const src = await readFile('app/(features)/projects/active/page.tsx', 'utf8');
    assert.match(src, /import Link from ['"]next\/link['"]/);
    assert.match(src, /href={\`\/projects\/\$\{p\.id\}\`}/);
  });

  it('completed projects page links to workspace', async () => {
    const { readFile } = await import('node:fs/promises');
    const src = await readFile('app/(features)/projects/completed/page.tsx', 'utf8');
    assert.match(src, /href={\`\/projects\/\$\{p\.id\}\`}/);
  });

  it('dashboard recent projects link to workspace', async () => {
    const { readFile } = await import('node:fs/promises');
    const src = await readFile('app/(features)/dashboard/page.tsx', 'utf8');
    assert.match(src, /href={\`\/projects\/\$\{project\.id\}\`}/);
  });
});

// ─── workspace page content ───────────────────────────────────────────────────

describe('Phase A workspace page content', () => {
  it('workspace page defines all 6 tabs', async () => {
    const { readFile } = await import('node:fs/promises');
    const src = await readFile('app/(features)/projects/[id]/page.tsx', 'utf8');
    const tabs: string[] = ['overview', 'programs', 'hmi', 'files', 'chats', 'notes'];
    for (const tab of tabs) {
      assert.match(src, new RegExp(tab), `Tab "${tab}" not found in workspace page`);
    }
  });

  it('workspace page fetches /api/projects/[id]', async () => {
    const { readFile } = await import('node:fs/promises');
    const src = await readFile('app/(features)/projects/[id]/page.tsx', 'utf8');
    assert.match(src, /\/api\/projects\/\$\{params/);
  });

  it('workspace page supports metadata PATCH save', async () => {
    const { readFile } = await import('node:fs/promises');
    const src = await readFile('app/(features)/projects/[id]/page.tsx', 'utf8');
    assert.match(src, /method: 'PATCH'/);
    assert.match(src, /Save Changes/);
  });

  it('workspace page has note create and delete', async () => {
    const { readFile } = await import('node:fs/promises');
    const src = await readFile('app/(features)/projects/[id]/page.tsx', 'utf8');
    assert.match(src, /Add Note/);
    assert.match(src, /deleteNote/);
  });

  it('workspace page shows 404 for missing project', async () => {
    const { readFile } = await import('node:fs/promises');
    const src = await readFile('app/(features)/projects/[id]/page.tsx', 'utf8');
    assert.match(src, /Project not found/);
  });
});

// ─── notes API route content ──────────────────────────────────────────────────

describe('Phase A notes API routes', () => {
  it('notes route handles GET and POST', async () => {
    const { readFile } = await import('node:fs/promises');
    const src = await readFile('app/api/projects/[id]/notes/route.ts', 'utf8');
    assert.match(src, /export async function GET/);
    assert.match(src, /export async function POST/);
    assert.match(src, /createProjectNote/);
  });

  it('notes/[noteId] route handles PATCH and DELETE', async () => {
    const { readFile } = await import('node:fs/promises');
    const src = await readFile('app/api/projects/[id]/notes/[noteId]/route.ts', 'utf8');
    assert.match(src, /export async function PATCH/);
    assert.match(src, /export async function DELETE/);
    assert.match(src, /updateProjectNote/);
    assert.match(src, /deleteProjectNote/);
  });
});

// ─── programs and files API content ──────────────────────────────────────────

describe('Phase A programs and files API routes', () => {
  it('programs route returns 404 for unknown project', async () => {
    const { readFile } = await import('node:fs/promises');
    const src = await readFile('app/api/projects/[id]/programs/route.ts', 'utf8');
    assert.match(src, /listProjectPrograms/);
    assert.match(src, /404/);
  });

  it('files route passes type query param', async () => {
    const { readFile } = await import('node:fs/promises');
    const src = await readFile('app/api/projects/[id]/files/route.ts', 'utf8');
    assert.match(src, /listProjectFiles/);
    assert.match(src, /type/);
  });

  it('chats route returns 404 for unknown project', async () => {
    const { readFile } = await import('node:fs/promises');
    const src = await readFile('app/api/projects/[id]/chats/route.ts', 'utf8');
    assert.match(src, /listProjectChats/);
    assert.match(src, /404/);
  });
});

// ─── GET on /api/projects/[id] ────────────────────────────────────────────────

describe('Phase A GET /api/projects/[id]', () => {
  it('route exports GET handler', async () => {
    const { readFile } = await import('node:fs/promises');
    const src = await readFile('app/api/projects/[id]/route.ts', 'utf8');
    assert.match(src, /export async function GET/);
    assert.match(src, /getProject/);
    assert.match(src, /404/);
  });

  it('route still exports PATCH and DELETE', async () => {
    const { readFile } = await import('node:fs/promises');
    const src = await readFile('app/api/projects/[id]/route.ts', 'utf8');
    assert.match(src, /export async function PATCH/);
    assert.match(src, /export async function DELETE/);
  });
});

describe('Phase B project selector wiring', () => {
  it('ProjectSelector component exists', async () => {
    await access('lib/components/ProjectSelector.tsx');
  });

  it('all Phase B pages import ProjectSelector', async () => {
    const { readFile } = await import('node:fs/promises');
    const pages = [
      'app/generator/page.tsx',
      'app/(features)/hmi-generator/page.tsx',
      'app/(features)/rectify-error/page.tsx',
      'app/(features)/plc-selector/page.tsx',
    ];
    for (const pagePath of pages) {
      const src = await readFile(pagePath, 'utf8');
      assert.match(src, /ProjectSelector/, `${pagePath} missing ProjectSelector`);
    }
  });
});

describe('Phase B API + DB persistence wiring', () => {
  it('generate-plc route reads projectId from FormData', async () => {
    const { readFile } = await import('node:fs/promises');
    const src = await readFile('app/api/generate-plc/route.ts', 'utf8');
    assert.match(src, /formData\.get\('projectId'\)/);
    assert.match(src, /persistGeneratedProgramIfAuthed\(\{\s*projectId/m);
  });

  it('hmi route accepts projectId and writes file operation row', async () => {
    const { readFile } = await import('node:fs/promises');
    const src = await readFile('app/api/hmi-generate/route.ts', 'utf8');
    assert.match(src, /projectId/);
    assert.match(src, /createFileOperation/);
    assert.match(src, /operationType: 'hmi_generate'/);
  });

  it('rectify route accepts projectId and writes rectification row', async () => {
    const { readFile } = await import('node:fs/promises');
    const src = await readFile('app/api/rectify-error/route.ts', 'utf8');
    assert.match(src, /projectId/);
    assert.match(src, /createErrorRectification/);
  });

  it('recommend route accepts projectId and writes recommendation row', async () => {
    const { readFile } = await import('node:fs/promises');
    const src = await readFile('app/api/recommend-plc/route.ts', 'utf8');
    assert.match(src, /projectId/);
    assert.match(src, /createPlcRecommendation/);
  });

  it('queries exports createFileOperation/createErrorRectification/createPlcRecommendation', async () => {
    const { readFile } = await import('node:fs/promises');
    const src = await readFile('lib/db/queries.ts', 'utf8');
    assert.match(src, /export async function createFileOperation/);
    assert.match(src, /export async function createErrorRectification/);
    assert.match(src, /export async function createPlcRecommendation/);
  });
});

describe('Phase C file uploads', () => {
  it('storage module exists with writeFile and deleteFile', async () => {
    await access('lib/storage.ts');
    const { readFile } = await import('node:fs/promises');
    const src = await readFile('lib/storage.ts', 'utf8');
    assert.match(src, /export async function writeFile/);
    assert.match(src, /export async function deleteFile/);
    assert.match(src, /MAX_UPLOAD_BYTES/);
    assert.match(src, /isAllowedUpload/);
  });

  it('files route handles GET and POST', async () => {
    const { readFile } = await import('node:fs/promises');
    const src = await readFile('app/api/projects/[id]/files/route.ts', 'utf8');
    assert.match(src, /export async function GET/);
    assert.match(src, /export async function POST/);
    assert.match(src, /operationType: 'user_upload'/);
    assert.match(src, /MAX_UPLOAD_BYTES/);
    assert.match(src, /isAllowedUpload/);
  });

  it('files/[fileId] route handles DELETE', async () => {
    await access('app/api/projects/[id]/files/[fileId]/route.ts');
    const { readFile } = await import('node:fs/promises');
    const src = await readFile('app/api/projects/[id]/files/[fileId]/route.ts', 'utf8');
    assert.match(src, /export async function DELETE/);
    assert.match(src, /deleteProjectFile/);
    assert.match(src, /deleteFile/);
  });

  it('queries exports getProjectFile and deleteProjectFile', async () => {
    const { readFile } = await import('node:fs/promises');
    const src = await readFile('lib/db/queries.ts', 'utf8');
    assert.match(src, /export async function getProjectFile/);
    assert.match(src, /export async function deleteProjectFile/);
    assert.match(src, /operationType !== 'user_upload'/);
  });

  it('workspace Files tab has upload drop zone and delete', async () => {
    const { readFile } = await import('node:fs/promises');
    const src = await readFile('app/(features)/projects/[id]/page.tsx', 'utf8');
    assert.match(src, /onDrop/);
    assert.match(src, /method: 'POST'/);
    assert.match(src, /method: 'DELETE'/);
    assert.match(src, /confirm\(/);
    assert.doesNotMatch(src, /Phase C/);
  });
});

describe('Phase D chat linkage', () => {
  it('chat context helper exists', async () => {
    await access('lib/project-chat-context.ts');
    await access('lib/chat-session-service.ts');
  });

  it('ai-chat route accepts projectId and sessionId', async () => {
    const { readFile } = await import('node:fs/promises');
    const src = await readFile('app/api/ai-chat/route.ts', 'utf8');
    assert.match(src, /projectId/);
    assert.match(src, /sessionId/);
    assert.match(src, /ensureChatSession/);
    assert.match(src, /withProjectContextMessages/);
    assert.match(src, /storeChatExchange/);
  });

  it('ai-engineer-chat route accepts projectId and sessionId', async () => {
    const { readFile } = await import('node:fs/promises');
    const src = await readFile('app/api/ai-engineer-chat/route.ts', 'utf8');
    assert.match(src, /projectId/);
    assert.match(src, /sessionId/);
    assert.match(src, /ensureChatSession/);
  });

  it('project chat replay route exists', async () => {
    await access('app/api/projects/[id]/chats/[sessionId]/route.ts');
    const { readFile } = await import('node:fs/promises');
    const src = await readFile('app/api/projects/[id]/chats/[sessionId]/route.ts', 'utf8');
    assert.match(src, /listProjectChatMessages/);
  });

  it('queries export chat session helpers', async () => {
    const { readFile } = await import('node:fs/promises');
    const src = await readFile('lib/db/queries.ts', 'utf8');
    assert.match(src, /export async function createChatSession/);
    assert.match(src, /export async function addChatMessage/);
    assert.match(src, /export async function listProjectChatMessages/);
    assert.match(src, /lastMessagePreview/);
  });

  it('chat UIs wire ProjectSelector and sessionId', async () => {
    const { readFile } = await import('node:fs/promises');
    for (const pagePath of ['app/(features)/ai-copilot/page.tsx', 'app/(features)/engineer-chat/page.tsx']) {
      const src = await readFile(pagePath, 'utf8');
      assert.match(src, /ProjectSelector/, `${pagePath} missing ProjectSelector`);
      assert.match(src, /sessionId/, `${pagePath} missing sessionId`);
      assert.match(src, /projectId/, `${pagePath} missing projectId`);
    }
  });

  it('workspace Chats tab supports replay', async () => {
    const { readFile } = await import('node:fs/promises');
    const src = await readFile('app/(features)/projects/[id]/page.tsx', 'utf8');
    assert.match(src, /lastMessagePreview/);
    assert.match(src, /toggleReplay/);
    assert.match(src, /\/api\/projects\/\$\{projectId\}\/chats\/\$\{sessionId\}/);
    assert.doesNotMatch(src, /Phase D/);
  });
});
