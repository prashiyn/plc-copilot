import { logUsage, requireUser } from '@/lib/db/queries';
import type { UsageEventType } from '@/lib/billing/usage-events';

export {
  AI_USAGE_EVENTS,
  PROGRAM_USAGE_EVENT,
  bytesToGb,
  isAiUsageEvent,
  usageEventLabel,
  type AiUsageEventType,
  type UsageEventType,
} from '@/lib/billing/usage-events';

/** Best-effort usage logging for signed-in users. Never throws. */
export async function recordUsage(eventType: UsageEventType, eventData?: unknown): Promise<void> {
  try {
    const user = await requireUser();
    if (!user) return;
    await logUsage(user, eventType, eventData);
  } catch (err) {
    console.warn('Could not record usage:', err);
  }
}
