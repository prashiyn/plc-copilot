import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from './index';
import { users, organizations } from './schema';

/**
 * Seed a demo user for local development: demo@plcai.com / demo1234 (superadmin).
 * Idempotent — safe to run repeatedly.
 */
async function main() {
  const email = 'demo@plcai.com';
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing) {
    console.log('Demo user already exists — nothing to do.');
    return;
  }

  const [org] = await db
    .insert(organizations)
    .values({ name: 'Demo Organization', slug: 'demo-org', subscriptionTier: 'enterprise' })
    .returning({ id: organizations.id });

  const passwordHash = await bcrypt.hash('demo1234', 10);
  await db.insert(users).values({
    email,
    fullName: 'Demo User',
    passwordHash,
    role: 'superadmin',
    organizationId: org.id,
  });

  console.log('Seeded demo user: demo@plcai.com / demo1234');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
