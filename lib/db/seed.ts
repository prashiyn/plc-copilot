import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { and, eq } from 'drizzle-orm';
import { db } from './index';
import { users, organizations, projects } from './schema';
import { getProjectTemplate, projectInputFromTemplate } from '@/lib/templates';

const DEMO_EMAIL = 'demo@plcai.com';

const SAMPLE_PROJECTS = [
  { name: 'Motor Start/Stop Demo', templateId: 'motor_startstop', status: 'in_progress' },
  { name: 'PID Temperature Control', templateId: 'pid_loop', status: 'completed' },
] as const;

async function seedSampleProjects(userId: string, organizationId: string | null) {
  for (const sample of SAMPLE_PROJECTS) {
    const [existing] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.userId, userId), eq(projects.name, sample.name)))
      .limit(1);
    if (existing) continue;

    const template = getProjectTemplate(sample.templateId);
    if (!template) continue;

    const input = projectInputFromTemplate(template, {
      name: sample.name,
      status: sample.status,
    });

    await db.insert(projects).values({
      userId,
      organizationId,
      name: input.name,
      description: input.description,
      plcManufacturer: input.plcManufacturer,
      plcModel: input.plcModel,
      applicationType: input.applicationType,
      industry: input.industry,
      templateId: input.templateId,
      status: input.status,
    });

    console.log(`Seeded project: ${sample.name}`);
  }
}

/**
 * Seed a demo user for local development: demo@plcai.com / demo1234 (superadmin).
 * Idempotent — safe to run repeatedly.
 */
async function main() {
  const [existing] = await db
    .select({ id: users.id, organizationId: users.organizationId })
    .from(users)
    .where(eq(users.email, DEMO_EMAIL))
    .limit(1);

  if (existing) {
    console.log('Demo user already exists — ensuring sample projects.');
    await seedSampleProjects(existing.id, existing.organizationId);
    return;
  }

  const [org] = await db
    .insert(organizations)
    .values({ name: 'Demo Organization', slug: 'demo-org', subscriptionTier: 'enterprise' })
    .returning({ id: organizations.id });

  const passwordHash = await bcrypt.hash('demo1234', 10);
  const [user] = await db
    .insert(users)
    .values({
      email: DEMO_EMAIL,
      fullName: 'Demo User',
      passwordHash,
      role: 'superadmin',
      organizationId: org.id,
    })
    .returning({ id: users.id });

  console.log('Seeded demo user: demo@plcai.com / demo1234');
  await seedSampleProjects(user.id, org.id);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
