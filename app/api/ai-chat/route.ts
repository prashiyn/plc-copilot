import { NextRequest, NextResponse } from 'next/server';
import { AutomationError, copilotChat, isAutomationConfigured } from '@/lib/automation-client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, mode = 'generate', uploadedImages = [] } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages array required' }, { status: 400 });
    }

    if (!isAutomationConfigured()) {
      return NextResponse.json({ error: 'Automation service not configured' }, { status: 500 });
    }

    const response = await copilotChat({ messages, mode, uploadedImages });

    return NextResponse.json({
      success: true,
      message: response.text,
      usage: response.usage,
    });
  } catch (error) {
    console.error('AI Chat error:', error);
    if (error instanceof AutomationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'AI chat failed' }, { status: 500 });
  }
}
