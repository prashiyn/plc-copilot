import { NextRequest, NextResponse } from 'next/server';
import { recommendPlc } from '@/lib/automation-client';

export async function POST(req: NextRequest) {
  try {
    const requirements = await req.json();
    const result = await recommendPlc(requirements);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error generating PLC recommendations:', error);
    return NextResponse.json({ error: 'Failed to generate recommendations' }, { status: 500 });
  }
}
