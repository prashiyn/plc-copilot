export interface ChatMessageInput {
  sender?: string;
  role?: string;
  content: string;
}

export function getLastUserMessage(messages: ChatMessageInput[]): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const sender = messages[i].sender ?? messages[i].role ?? '';
    if (sender === 'user') return messages[i].content;
  }
  return null;
}
