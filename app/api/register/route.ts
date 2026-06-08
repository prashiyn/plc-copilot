import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users, organizations } from '@/lib/db/schema';

/**
 * Register a new user. Each signup creates its own organization; the user
 * becomes its admin. The very first user in the system becomes superadmin.
 */
export async function POST(request: NextRequest) {
  let body: {
    email?: string;
    password?: string;
    fullName?: string;
    organizationName?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: 'Password must be at least 8 characters.' },
      { status: 400 },
    );
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing) {
    return NextResponse.json(
      { error: 'An account with this email already exists.' },
      { status: 409 },
    );
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users);
  const isFirstUser = count === 0;

  const orgName = String(
    body.organizationName || body.fullName || email.split('@')[0] || 'My Organization',
  ).trim();
  const baseSlug =
    orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'org';
  const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;

  const passwordHash = await bcrypt.hash(password, 10);

  const [org] = await db
    .insert(organizations)
    .values({ name: orgName, slug })
    .returning({ id: organizations.id });

  const [user] = await db
    .insert(users)
    .values({
      email,
      fullName: body.fullName ? String(body.fullName) : null,
      passwordHash,
      role: isFirstUser ? 'superadmin' : 'admin',
      organizationId: org.id,
    })
    .returning({ id: users.id, email: users.email, role: users.role });

  return NextResponse.json({ ok: true, user });
}
