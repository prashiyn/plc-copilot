import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { resolveBillingPeriod, nextBillingDate } from './billing/billing-period';
import {
  computeOverLimit,
  normalizeSubscriptionTier,
  resolvePlanDisplay,
  resolvePlanLimits,
  usagePercent,
} from './billing/plan-limits';
import { AI_USAGE_EVENTS, bytesToGb, isAiUsageEvent, usageEventLabel } from './billing/usage-events';

describe('plan limits', () => {
  it('normalizes unknown tiers to free', () => {
    assert.equal(normalizeSubscriptionTier(undefined), 'free');
    assert.equal(normalizeSubscriptionTier('unknown'), 'free');
    assert.equal(normalizeSubscriptionTier('professional'), 'professional');
  });

  it('resolves tier limits', () => {
    const free = resolvePlanLimits('free');
    const pro = resolvePlanLimits('professional');
    assert.equal(free.programsPerMonth, 10);
    assert.equal(pro.aiRequestsPerMonth, 500);
    assert.ok(pro.storageGb > free.storageGb);
  });

  it('resolves plan display metadata', () => {
    const plan = resolvePlanDisplay('enterprise');
    assert.equal(plan.name, 'Enterprise');
    assert.equal(plan.priceMonthly, 299);
  });

  it('computes over-limit flags', () => {
    const limits = resolvePlanLimits('free');
    const within = computeOverLimit(
      { programs: 5, aiRequests: 10, storageGb: 0.5, teamSeats: 1 },
      limits,
    );
    assert.equal(within.programs, false);

    const over = computeOverLimit(
      { programs: 11, aiRequests: 51, storageGb: 2, teamSeats: 2 },
      limits,
    );
    assert.equal(over.programs, true);
    assert.equal(over.aiRequests, true);
    assert.equal(over.storageGb, true);
    assert.equal(over.teamSeats, true);
  });

  it('calculates usage percent capped at 100', () => {
    assert.equal(usagePercent(5, 10), 50);
    assert.equal(usagePercent(20, 10), 100);
  });
});

describe('billing period', () => {
  it('uses calendar month when no subscription anchor', () => {
    const ref = new Date('2026-06-16T12:00:00Z');
    const period = resolveBillingPeriod(null, 0, ref);
    assert.equal(period.start.getMonth(), 5);
    assert.equal(period.start.getDate(), 1);
    assert.equal(period.end.getMonth(), 5);
    assert.equal(period.end.getDate(), 30);
  });

  it('offsets to previous calendar month', () => {
    const ref = new Date('2026-06-16T12:00:00Z');
    const period = resolveBillingPeriod(null, 1, ref);
    assert.equal(period.start.getMonth(), 4);
    assert.equal(period.end.getMonth(), 4);
  });

  it('anchors period to subscription start day', () => {
    const anchor = new Date('2025-01-15T00:00:00Z');
    const ref = new Date('2026-06-16T12:00:00Z');
    const period = resolveBillingPeriod(anchor, 0, ref);
    assert.equal(period.start.getDate(), 15);
    assert.equal(period.start.getMonth(), 5);
    const billing = nextBillingDate(period);
    assert.equal(billing.getDate(), 15);
    assert.equal(billing.getMonth(), 6);
  });
});

describe('usage helpers', () => {
  it('classifies AI usage events', () => {
    assert.equal(isAiUsageEvent('ai_chat'), true);
    assert.equal(isAiUsageEvent('program_generated'), false);
    assert.equal(AI_USAGE_EVENTS.length, 10);
  });

  it('maps event labels for UI', () => {
    assert.equal(usageEventLabel('hmi_generate'), 'HMI Generator');
  });

  it('converts bytes to gigabytes', () => {
    assert.equal(bytesToGb(1024 * 1024 * 1024), 1);
    assert.equal(bytesToGb(512 * 1024 * 1024), 0.5);
  });
});

describe('generation routes record usage', () => {
  const ROUTE_EVENTS: Array<[string, string]> = [
    ['app/api/ai-chat/route.ts', "recordUsage('ai_chat'"],
    ['app/api/ai-engineer-chat/route.ts', "recordUsage('engineer_chat'"],
    ['app/api/ai-generate-application/route.ts', "recordUsage('ai_application'"],
    ['app/api/ai-library-search/route.ts', "recordUsage('ai_library'"],
    ['app/api/ai-optimize-code/route.ts', "recordUsage('ai_optimize'"],
    ['app/api/recommend-plc/route.ts', "recordUsage('recommend_plc'"],
    ['app/api/recommend-solution/route.ts', "recordUsage('recommend_solution'"],
    ['app/api/rectify-error/route.ts', "recordUsage('rectify_error'"],
    ['app/api/generate-from-sketch/route.ts', "recordUsage('sketch_generate'"],
    ['app/api/hmi-generate/route.ts', "recordUsage('hmi_generate'"],
  ];

  for (const [routePath, needle] of ROUTE_EVENTS) {
    it(`${routePath} calls ${needle}`, () => {
      const source = readFileSync(routePath, 'utf-8');
      assert.match(source, /recordUsage\(/);
      assert.ok(source.includes(needle));
    });
  }
});
