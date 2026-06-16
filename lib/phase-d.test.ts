import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { listDocArticles, searchDocArticles } from './content/docs';
import { filterTutorials, listTutorials } from './content/tutorials';
import { buildGeneratorUrl, getProjectTemplate, listProjectTemplates } from './templates';
import {
  mergeAppPreferences,
  mergeNotificationSettings,
  mergeProfile,
  parseUserSettings,
} from './user-settings';

describe('project templates', () => {
  it('lists export patterns including pid_loop', () => {
    const templates = listProjectTemplates();
    assert.ok(templates.length >= 10);
    assert.ok(templates.some((t) => t.pattern === 'pid_loop'));
  });

  it('builds generator URL with logic and setpoint', () => {
    const template = getProjectTemplate('pid_loop');
    assert.ok(template);
    const url = buildGeneratorUrl(template!);
    assert.match(url, /template=pid_loop/);
    assert.match(url, /setpoint=50/);
  });
});

describe('user settings merges', () => {
  it('merges profile from fullName fallback', () => {
    const profile = mergeProfile('user@example.com', 'Jane Doe', {});
    assert.equal(profile.email, 'user@example.com');
    assert.equal(profile.firstName, 'Jane');
    assert.equal(profile.lastName, 'Doe');
  });

  it('merges app and notification defaults', () => {
    const stored = parseUserSettings({ app: { theme: 'dark' } });
    assert.equal(mergeAppPreferences(stored).theme, 'dark');
    assert.equal(mergeNotificationSettings(stored).programGenerated.email, true);
  });
});

describe('content registry', () => {
  it('searches documentation articles', () => {
    const results = searchDocArticles('siemens', 'all');
    assert.ok(results.some((doc) => doc.slug === 'siemens-tia-portal'));
  });

  it('loads markdown-backed doc article', async () => {
    const { getDocArticle } = await import('./content/docs');
    const article = getDocArticle('quick-start');
    assert.ok(article);
    assert.match(article!.content, /PLCAutoPilot/);
    assert.equal(listDocArticles().length, 7);
  });

  it('filters tutorials by difficulty', () => {
    const beginner = filterTutorials('all', 'beginner');
    assert.ok(beginner.length >= 1);
    assert.equal(listTutorials().length, 5);
  });
});

describe('Phase D API routes exist', () => {
  const ROUTES = [
    'app/api/settings/profile/route.ts',
    'app/api/settings/preferences/route.ts',
    'app/api/settings/notifications/route.ts',
    'app/api/settings/password/route.ts',
    'app/api/settings/api-keys/route.ts',
    'app/api/support/contact/route.ts',
    'app/api/support/tickets/route.ts',
    'app/api/templates/route.ts',
    'app/api/resources/docs/route.ts',
    'app/api/resources/docs/[slug]/route.ts',
    'app/api/resources/tutorials/route.ts',
    'app/api/forum/threads/route.ts',
  ];

  for (const routePath of ROUTES) {
    it(`${routePath} is present`, async () => {
      const { access } = await import('node:fs/promises');
      await access(routePath);
    });
  }
});

describe('Phase E — v1.5 follow-ups still wired', () => {
  it('programs page fetches /api/programs', async () => {
    const { readFile } = await import('node:fs/promises');
    const src = await readFile('app/(features)/programs/page.tsx', 'utf8');
    assert.match(src, /fetch\(['"]\/api\/programs['"]\)/);
  });

  it('sketch-generator page calls /api/generate-from-sketch', async () => {
    const { readFile } = await import('node:fs/promises');
    const src = await readFile('app/(features)/sketch-generator/page.tsx', 'utf8');
    assert.match(src, /\/api\/generate-from-sketch/);
  });

  it('solution compare uses /api/plc-catalog', async () => {
    const { readFile } = await import('node:fs/promises');
    const src = await readFile('app/(features)/solutions/compare/page.tsx', 'utf8');
    assert.match(src, /\/api\/plc-catalog/);
  });

  it('orphan AI BFF routes remain removed', async () => {
    const { access } = await import('node:fs/promises');
    const orphans = [
      'app/api/ai-copilot/route.ts',
      'app/api/ai-application-generator/route.ts',
      'app/api/ai-library-manager/route.ts',
      'app/api/ai-code-optimizer/route.ts',
    ];
    for (const routePath of orphans) {
      await assert.rejects(() => access(routePath), /ENOENT/);
    }
  });

  it('canonical AI BFF routes exist', async () => {
    const { access } = await import('node:fs/promises');
    const canonical = [
      'app/api/ai-chat/route.ts',
      'app/api/ai-generate-application/route.ts',
      'app/api/ai-library-search/route.ts',
      'app/api/ai-optimize-code/route.ts',
      'app/api/hmi-generate/route.ts',
      'app/api/usage/route.ts',
    ];
    for (const routePath of canonical) {
      await access(routePath);
    }
  });
});
