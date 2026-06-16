import { NextRequest, NextResponse } from 'next/server';
import { AutomationError, engineerChat, isAutomationConfigured } from '@/lib/automation-client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, engineerType = 'general-expert', conversationContext = {} } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages array required' }, { status: 400 });
    }

    if (!isAutomationConfigured()) {
      return NextResponse.json({ error: 'Automation service not configured' }, { status: 500 });
    }

    const response = await engineerChat({
      messages,
      engineerType,
      conversationContext,
    });

    return NextResponse.json({
      success: true,
      message: response.text,
      engineer: response.engineer,
      usage: response.usage,
    });
  } catch (error: unknown) {
    console.error('Engineer chat error:', error);
    if (error instanceof AutomationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Engineer chat failed' },
      { status: 500 },
    );
  }
}
