import { NextRequest, NextResponse } from 'next/server';
import { recommendSolution } from '@/lib/automation-client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectDescription, criteria = 'balanced', constraints } = body;
    const result = await recommendSolution({ projectDescription, criteria, constraints });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error generating recommendation:', error);
    return NextResponse.json({ error: 'Failed to generate recommendation' }, { status: 500 });
  }
}
