export const AI_USAGE_EVENTS = [
  'ai_chat',
  'ai_application',
  'ai_optimize',
  'ai_library',
  'engineer_chat',
  'recommend_plc',
  'recommend_solution',
  'rectify_error',
  'sketch_generate',
  'hmi_generate',
] as const;

export type AiUsageEventType = (typeof AI_USAGE_EVENTS)[number];

export const PROGRAM_USAGE_EVENT = 'program_generated' as const;

export type UsageEventType =
  | AiUsageEventType
  | typeof PROGRAM_USAGE_EVENT
  | 'project_created';

const EVENT_LABELS: Record<string, string> = {
  ai_chat: 'AI Copilot Chat',
  ai_application: 'Application Generator',
  ai_optimize: 'Code Optimization',
  ai_library: 'Library Search',
  engineer_chat: 'Engineer Chat',
  recommend_plc: 'PLC Recommendation',
  recommend_solution: 'Solution Recommendation',
  rectify_error: 'Error Rectification',
  sketch_generate: 'Sketch to PLC',
  hmi_generate: 'HMI Generator',
  program_generated: 'PLC Program',
  project_created: 'Project Created',
};

export function isAiUsageEvent(eventType: string): boolean {
  return (AI_USAGE_EVENTS as readonly string[]).includes(eventType);
}

export function usageEventLabel(eventType: string): string {
  return EVENT_LABELS[eventType] ?? eventType;
}

export function bytesToGb(bytes: number): number {
  return Math.round((bytes / (1024 * 1024 * 1024)) * 100) / 100;
}
