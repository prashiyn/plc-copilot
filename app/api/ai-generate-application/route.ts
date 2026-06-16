import { NextRequest, NextResponse } from 'next/server';
import { AutomationError, generateApplication, isAutomationConfigured } from '@/lib/automation-client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      requirements,
      applicationType,
      platform = 'schneider',
      controller,
      ioCount,
      safetyLevel = 'standard',
    } = body;

    if (!requirements) {
      return NextResponse.json({ error: 'Application requirements required' }, { status: 400 });
    }

    if (!isAutomationConfigured()) {
      return NextResponse.json({ error: 'Automation service not configured' }, { status: 500 });
    }

    const { application } = await generateApplication({
      requirements,
      applicationType,
      platform,
      controller,
      ioCount,
      safetyLevel,
    });

    return NextResponse.json({ success: true, application });
  } catch (error) {
    console.error('Application generation error:', error);
    if (error instanceof AutomationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Application generation failed' }, { status: 500 });
  }
}
