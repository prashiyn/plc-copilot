import { NextRequest, NextResponse } from 'next/server';
import { rectifyError } from '@/lib/automation-client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { programCode, platform, errorScreenshot, errorMessage, plcModel } = body;
    const result = await rectifyError({
      programCode,
      platform,
      errorMessage,
      plcModel,
      errorScreenshot,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error processing rectification request:', error);
    return NextResponse.json(
      { error: 'Failed to process error rectification request' },
      { status: 500 },
    );
  }
}
