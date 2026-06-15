import { NextRequest, NextResponse } from 'next/server';
import { aiChat, AutomationError, isAutomationConfigured } from '@/lib/automation-client';

const SYSTEM_PROMPT = `You are an expert industrial automation application architect.
Generate complete PLC application structures based on requirements.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { description, plcPlatform, applicationSize } = body;

    if (!description) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 });
    }

    if (!isAutomationConfigured()) {
      return NextResponse.json({ error: 'Automation service not configured' }, { status: 500 });
    }

    const prompt = `Generate a complete PLC application:
Description: ${description}
Platform: ${plcPlatform || 'IEC 61131-3'}
Size: ${applicationSize || 'medium'}`;

    const response = await aiChat({
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 8192,
      model: process.env.CLAUDE_MODEL,
    });

    return NextResponse.json({ success: true, response: response.text, usage: response.usage });
  } catch (error) {
    console.error('AI Application Generator Error:', error);
    if (error instanceof AutomationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Failed to generate application' }, { status: 500 });
  }
}
