import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/db/queries';
import { createUserApiKey, listUserApiKeys, revokeUserApiKey } from '@/lib/db/settings';

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const keys = await listUserApiKeys(user);
  return NextResponse.json({ keys });
}

export async function POST(request: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const keyName = String(body.keyName ?? body.name ?? 'API Key').trim();
  if (!keyName) return NextResponse.json({ error: 'Key name is required' }, { status: 400 });

  const created = await createUserApiKey(user, keyName);
  return NextResponse.json({ success: true, key: created }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const keyId = request.nextUrl.searchParams.get('id');
  if (!keyId) return NextResponse.json({ error: 'Key id is required' }, { status: 400 });

  const revoked = await revokeUserApiKey(user, keyId);
  if (!revoked) return NextResponse.json({ error: 'Key not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}
