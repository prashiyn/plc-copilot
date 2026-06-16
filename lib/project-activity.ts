import { usageEventLabel } from '@/lib/billing/usage-events';

export interface ProjectActivityItem {
  id: string;
  eventType: string;
  label: string;
  detail: string | null;
  createdAt: string | null;
}

const FILE_OP_LABELS: Record<string, string> = {
  user_upload: 'File uploaded',
  hmi_generate: 'HMI generated',
};

export function activityLabelForFileOperation(operationType: string, fileName: string | null): string {
  const base = FILE_OP_LABELS[operationType] ?? 'File operation';
  return fileName ? `${base}: ${fileName}` : base;
}

export function activityLabelForProgram(fileName: string | null, programFormat: string | null): string {
  if (fileName) return `Program generated: ${fileName}`;
  if (programFormat) return `Program generated (${programFormat})`;
  return 'Program generated';
}

export function activityLabelForNote(title: string): string {
  return title.trim() ? `Note added: ${title}` : 'Note added';
}

export function activityLabelForRectification(errorMessage: string | null): string {
  if (errorMessage?.trim()) {
    const snippet = errorMessage.trim().slice(0, 80);
    return snippet.length < errorMessage.trim().length
      ? `Error rectified: ${snippet}…`
      : `Error rectified: ${snippet}`;
  }
  return 'Error rectified';
}

export function activityLabelForRecommendation(criteria: string | null): string {
  return criteria ? `PLC recommendation (${criteria})` : 'PLC recommendation';
}

export function activityLabelForUsageEvent(eventType: string, eventData: unknown): string {
  const label = usageEventLabel(eventType);
  if (eventData && typeof eventData === 'object' && eventData !== null) {
    const data = eventData as Record<string, unknown>;
    if (typeof data.name === 'string' && data.name) return `${label}: ${data.name}`;
    if (typeof data.fileName === 'string' && data.fileName) return `${label}: ${data.fileName}`;
  }
  return label;
}

export function mergeProjectActivity(
  items: ProjectActivityItem[],
  limit = 10,
): ProjectActivityItem[] {
  return items
    .filter((item) => item.createdAt)
    .sort((a, b) => {
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bt - at;
    })
    .slice(0, limit);
}
