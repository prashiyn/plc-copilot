'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

interface UsageSummary {
  plan: {
    name: string;
    priceMonthly: number;
    status: string;
    nextBillingDate: string;
    tier: string;
  };
  limits: {
    programsPerMonth: number;
    aiRequestsPerMonth: number;
    storageGb: number;
    teamSeats: number;
  };
  used: {
    programs: number;
    aiRequests: number;
    storageGb: number;
    teamSeats: number;
  };
  percentages: {
    programs: number;
    aiRequests: number;
    storageGb: number;
    teamSeats: number;
  };
  period: { label: string };
}

const TIER_FEATURES: Record<string, string[]> = {
  free: [
    'AI-Powered PLC Code Generation',
    'Multi-Platform Support',
    'Community documentation',
    'Single user',
  ],
  professional: [
    'AI-Powered PLC Code Generation',
    'Multi-Platform Support (Siemens, Rockwell, Mitsubishi)',
    'Advanced Debugging Tools',
    'IEC 61131-3 Compliance',
    'Version Control Integration',
    'Team Collaboration',
    'Priority Email Support',
    'API Access',
    'Custom Templates',
  ],
  enterprise: [
    'AI-Powered PLC Code Generation',
    'Multi-Platform Support (Siemens, Rockwell, Mitsubishi)',
    'Advanced Debugging Tools',
    'IEC 61131-3 Compliance',
    'Version Control Integration',
    'Team Collaboration',
    'Priority Email Support',
    'API Access',
    'Custom Templates',
    '24/7 Phone Support',
    'Dedicated Account Manager',
    'On-Premises Deployment',
  ],
};

export default function PlanPage() {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/usage')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUsage(data))
      .catch(() => setUsage(null))
      .finally(() => setLoading(false));
  }, []);

  const tier = usage?.plan.tier ?? 'free';
  const features = TIER_FEATURES[tier] ?? TIER_FEATURES.free;
  const allFeatures = TIER_FEATURES.enterprise;
  const nextBilling = usage?.plan.nextBillingDate
    ? new Date(usage.plan.nextBillingDate).toLocaleDateString()
    : '—';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Your Plan</h1>
        <p className="text-gray-600">Manage your subscription and view plan details</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm mb-8">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold text-gray-900">
                  {loading ? 'Loading…' : usage?.plan.name ?? 'Free'}
                </h2>
                <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                  {(usage?.plan.status ?? 'active').toUpperCase()}
                </span>
              </div>
              <p className="text-gray-600">
                <span className="text-3xl font-bold text-gray-900">
                  ${usage?.plan.priceMonthly ?? 0}
                </span>
                <span className="text-lg">/month</span>
              </p>
            </div>
            <div className="text-right">
              <Link
                href="/billing/upgrade"
                className="inline-block px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors mb-2"
              >
                Upgrade Plan
              </Link>
              <p className="text-sm text-gray-500">Next billing: {nextBilling}</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-500 mb-1">Billing Period</p>
              <p className="text-base font-medium text-gray-900">{usage?.period.label ?? '—'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Plan Tier</p>
              <p className="text-base font-medium text-gray-900 capitalize">{tier}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm mb-8">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Current Usage</h2>
          <p className="text-gray-600 mt-1">Your usage for this billing period</p>
        </div>

        <div className="p-6">
          <div className="space-y-6">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">PLC Programs Generated</span>
                <span className="text-sm text-gray-600">
                  {usage?.used.programs ?? 0} / {usage?.limits.programsPerMonth ?? '—'}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-blue-600 h-2.5 rounded-full"
                  style={{ width: `${usage?.percentages.programs ?? 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">AI Generation Requests</span>
                <span className="text-sm text-gray-600">
                  {usage?.used.aiRequests ?? 0} / {usage?.limits.aiRequestsPerMonth ?? '—'}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-green-600 h-2.5 rounded-full"
                  style={{ width: `${usage?.percentages.aiRequests ?? 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">Team Members</span>
                <span className="text-sm text-gray-600">
                  {usage?.used.teamSeats ?? 0} / {usage?.limits.teamSeats ?? '—'}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-purple-600 h-2.5 rounded-full"
                  style={{ width: `${usage?.percentages.teamSeats ?? 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">Storage Used</span>
                <span className="text-sm text-gray-600">
                  {usage?.used.storageGb ?? 0} GB / {usage?.limits.storageGb ?? '—'} GB
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-orange-600 h-2.5 rounded-full"
                  style={{ width: `${usage?.percentages.storageGb ?? 0}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <Link href="/billing/usage" className="text-blue-600 hover:text-blue-700 font-medium text-sm">
              View Detailed Usage Report
            </Link>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Plan Features</h2>
          <p className="text-gray-600 mt-1">What is included in your plan</p>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {allFeatures.map((feature) => {
              const included = features.includes(feature);
              return (
                <div key={feature} className="flex items-start gap-3">
                  {included ? (
                    <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-gray-300 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  <span className={`text-sm ${included ? 'text-gray-700' : 'text-gray-400 line-through'}`}>
                    {feature}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/subscription/manage" className="block p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-500 transition-colors">
          <h3 className="font-medium text-gray-900 mb-1">Manage Subscription</h3>
          <p className="text-sm text-gray-600">Change or cancel your subscription</p>
        </Link>
        <Link href="/billing/invoices" className="block p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-500 transition-colors">
          <h3 className="font-medium text-gray-900 mb-1">View Invoices</h3>
          <p className="text-sm text-gray-600">Download past invoices and receipts</p>
        </Link>
        <Link href="/subscription/addons" className="block p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-500 transition-colors">
          <h3 className="font-medium text-gray-900 mb-1">Add-ons</h3>
          <p className="text-sm text-gray-600">Extend your plan with add-ons</p>
        </Link>
      </div>
    </div>
  );
}
