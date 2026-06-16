import { NextRequest, NextResponse } from 'next/server';
import { AutomationError, isAutomationConfigured, optimizeCode } from '@/lib/automation-client';
import { recordUsage } from '@/lib/usage';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, platform = 'schneider', optimizationGoals = [], currentIssues = '' } = body;

    if (!code) {
      return NextResponse.json({ error: 'PLC code required for analysis' }, { status: 400 });
    }

    if (!isAutomationConfigured()) {
      return NextResponse.json({ error: 'Automation service not configured' }, { status: 500 });
    }

    const { analysis } = await optimizeCode({
      code,
      platform,
      optimizationGoals,
      currentIssues,
    });

    await recordUsage('ai_optimize', { platform });

    return NextResponse.json({ success: true, analysis });
  } catch (error) {
    console.error('Code optimization error:', error);
    if (error instanceof AutomationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Code optimization failed' }, { status: 500 });
  }
}
