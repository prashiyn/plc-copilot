import { NextRequest, NextResponse } from 'next/server';
import { aiJson, AutomationError, isAutomationConfigured } from '@/lib/automation-client';

const SYSTEM_PROMPT = `You are an expert PLC application architect. Generate complete applications. Respond with JSON only.`;

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

    const prompt = `Generate a complete PLC application.
Requirements: ${requirements}
Type: ${applicationType || 'Industrial Control'}
Platform: ${platform}
Controller: ${controller || 'auto'}
I/O: ${ioCount || 'as needed'}
Safety: ${safetyLevel}

Return JSON with application_name, platform, controller, program_code, io_assignments, variables, safety_features, testing_procedure.`;

    const application = await aiJson({ system: SYSTEM_PROMPT, prompt, maxTokens: 8192 });

    return NextResponse.json({ success: true, application });
  } catch (error) {
    console.error('Application generation error:', error);
    if (error instanceof AutomationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Application generation failed' }, { status: 500 });
  }
}
