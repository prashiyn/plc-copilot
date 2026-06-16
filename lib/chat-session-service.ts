import {
  addChatMessage,
  createChatSession,
  getChatSession,
  linkChatToProject,
  resolveProjectForChat,
  type SessionUser,
} from '@/lib/db/queries';
import { getLastUserMessage } from '@/lib/chat-message-utils';
import { buildProjectContextBlock, prependProjectContext } from '@/lib/project-chat-context';

export { getLastUserMessage } from '@/lib/chat-message-utils';
export type { ChatMessageInput } from '@/lib/chat-message-utils';

export async function ensureChatSession(
  user: SessionUser,
  input: {
    sessionId?: string | null;
    projectId?: string | null;
    engineerName?: string | null;
    engineerSpecialty?: string | null;
  },
) {
  const scopedProjectId =
    typeof input.projectId === 'string' && input.projectId.trim() ? input.projectId.trim() : null;

  if (input.sessionId) {
    const session = await getChatSession(user, input.sessionId);
    if (!session) throw new Error('Session not found');
    if (scopedProjectId) {
      await linkChatToProject(user, scopedProjectId, session.id);
    }
    return session;
  }

  const session = await createChatSession(user, {
    engineerName: input.engineerName,
    engineerSpecialty: input.engineerSpecialty,
  });
  if (scopedProjectId) {
    await linkChatToProject(user, scopedProjectId, session.id);
  }
  return session;
}

export async function withProjectContextMessages(
  user: SessionUser,
  messages: ChatMessageInput[],
  projectId?: string | null,
  sessionId?: string | null,
) {
  const project = await resolveProjectForChat(user, projectId, sessionId);
  if (!project) return messages;
  return prependProjectContext(messages, buildProjectContextBlock(project));
}

export async function storeChatExchange(
  user: SessionUser,
  sessionId: string,
  userMessage: string,
  assistantMessage: string,
  assistantSender = 'assistant',
) {
  await addChatMessage(user, sessionId, 'user', userMessage);
  await addChatMessage(user, sessionId, assistantSender, assistantMessage);
}
