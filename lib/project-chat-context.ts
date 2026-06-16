export interface ProjectContextSource {
  name: string;
  plcManufacturer?: string | null;
  plcModel?: string | null;
  industry?: string | null;
}

export function buildProjectContextBlock(project: ProjectContextSource): string {
  const lines = [`Project: "${project.name}"`];
  const plc = [project.plcManufacturer, project.plcModel].filter(Boolean).join(' ');
  if (plc) lines.push(`PLC: ${plc}`);
  if (project.industry) lines.push(`Industry: ${project.industry}`);
  return lines.join('\n');
}

export function prependProjectContext<T extends { sender?: string; role?: string; content: string }>(
  messages: T[],
  contextBlock: string,
): T[] {
  if (messages.some((m) => m.content.includes('Project context:'))) {
    return messages;
  }
  return [
    {
      sender: 'system',
      role: 'system',
      content: `Project context:\n${contextBlock}`,
    } as T,
    ...messages,
  ];
}
