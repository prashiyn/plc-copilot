import { NextRequest, NextResponse } from 'next/server';
import { AutomationError, engineerChat, isAutomationConfigured } from '@/lib/automation-client';
import {
  ensureChatSession,
  getLastUserMessage,
  storeChatExchange,
  withProjectContextMessages,
} from '@/lib/chat-session-service';
import { requireUser } from '@/lib/db/queries';
import { recordUsage } from '@/lib/usage';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      messages,
      engineerType = 'general-expert',
      conversationContext = {},
      projectId = null,
      sessionId = null,
    } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages array required' }, { status: 400 });
    }

    const lastUserMessage = getLastUserMessage(messages);
    if (!lastUserMessage) {
      return NextResponse.json({ error: 'A user message is required' }, { status: 400 });
    }

    if (!isAutomationConfigured()) {
      return NextResponse.json({ error: 'Automation service not configured' }, { status: 500 });
    }

    const user = await requireUser();
    let activeSessionId: string | null = typeof sessionId === 'string' ? sessionId : null;

    let contextualMessages = messages;
    if (user) {
      try {
        const session = await ensureChatSession(user, {
          sessionId: activeSessionId,
          projectId: typeof projectId === 'string' ? projectId : null,
        });
        activeSessionId = session.id;
        contextualMessages = await withProjectContextMessages(
          user,
          messages,
          typeof projectId === 'string' ? projectId : null,
          session.id,
        );
      } catch (err) {
        if (err instanceof Error && (err.message === 'Session not found' || err.message === 'Invalid projectId')) {
          return NextResponse.json({ error: err.message }, { status: 404 });
        }
        throw err;
      }
    }

    const response = await engineerChat({
      messages: contextualMessages,
      engineerType,
      conversationContext,
    });

    if (user && activeSessionId) {
      await storeChatExchange(user, activeSessionId, lastUserMessage, response.text, 'engineer');
    }

    await recordUsage('engineer_chat', { engineerType, sessionId: activeSessionId ?? undefined });

    return NextResponse.json({
      success: true,
      message: response.text,
      sessionId: activeSessionId,
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
