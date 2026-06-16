export type SubscriptionTier = 'free' | 'professional' | 'enterprise';

export interface PlanLimits {
  programsPerMonth: number;
  aiRequestsPerMonth: number;
  storageGb: number;
  teamSeats: number;
}

export interface PlanDisplay {
  tier: SubscriptionTier;
  name: string;
  priceMonthly: number;
}

const TIER_LIMITS: Record<SubscriptionTier, PlanLimits> = {
  free: {
    programsPerMonth: 10,
    aiRequestsPerMonth: 50,
    storageGb: 1,
    teamSeats: 1,
  },
  professional: {
    programsPerMonth: 100,
    aiRequestsPerMonth: 500,
    storageGb: 10,
    teamSeats: 5,
  },
  enterprise: {
    programsPerMonth: 1000,
    aiRequestsPerMonth: 5000,
    storageGb: 100,
    teamSeats: 50,
  },
};

const PLAN_DISPLAY: Record<SubscriptionTier, Omit<PlanDisplay, 'tier'>> = {
  free: { name: 'Free', priceMonthly: 0 },
  professional: { name: 'Professional', priceMonthly: 99 },
  enterprise: { name: 'Enterprise', priceMonthly: 299 },
};

export function normalizeSubscriptionTier(tier: string | null | undefined): SubscriptionTier {
  if (tier === 'professional' || tier === 'enterprise') return tier;
  return 'free';
}

export function resolvePlanLimits(tier: string | null | undefined): PlanLimits {
  return TIER_LIMITS[normalizeSubscriptionTier(tier)];
}

export function resolvePlanDisplay(tier: string | null | undefined): PlanDisplay {
  const normalized = normalizeSubscriptionTier(tier);
  return { tier: normalized, ...PLAN_DISPLAY[normalized] };
}

export interface UsageCounts {
  programs: number;
  aiRequests: number;
  storageGb: number;
  teamSeats: number;
}

export interface OverLimitFlags {
  programs: boolean;
  aiRequests: boolean;
  storageGb: boolean;
  teamSeats: boolean;
}

export function computeOverLimit(used: UsageCounts, limits: PlanLimits): OverLimitFlags {
  return {
    programs: used.programs > limits.programsPerMonth,
    aiRequests: used.aiRequests > limits.aiRequestsPerMonth,
    storageGb: used.storageGb > limits.storageGb,
    teamSeats: used.teamSeats > limits.teamSeats,
  };
}

export function usagePercent(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 1000) / 10);
}
