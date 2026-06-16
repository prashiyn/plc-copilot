'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

interface UsageSummary {
  period: { label: string };
  plan: { name: string };
  limits: { programsPerMonth: number; aiRequestsPerMonth: number; storageGb: number };
  used: { programs: number; aiRequests: number; storageGb: number };
  percentages: { programs: number; aiRequests: number; storageGb: number };
  overLimit: {
    programs: boolean;
    aiRequests: boolean;
    storageGb: boolean;
    teamSeats: boolean;
  };
  recentPrograms: Array<{ date: string; count: number; label: string }>;
  recentAiRequests: Array<{ date: string; count: number; label: string }>;
  breakdownByType: Record<string, number>;
}

const PERIOD_OPTIONS = [
  { value: '0', label: 'Current Period' },
  { value: '1', label: 'Last Period' },
  { value: '2', label: '2 Months Ago' },
  { value: '3', label: '3 Months Ago' },
];

export default function UsagePage() {
  const [selectedPeriod, setSelectedPeriod] = useState('0');
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    fetch(`/api/usage?periodOffset=${selectedPeriod}`)
      .then(async (res) => {
        if (res.status === 401) {
          setError('Sign in to view usage details.');
          setUsage(null);
          return;
        }
        if (!res.ok) {
          setError('Could not load usage data.');
          return;
        }
        setUsage(await res.json());
      })
      .catch(() => setError('Could not load usage data.'))
      .finally(() => setLoading(false));
  }, [selectedPeriod]);

  const exportCsv = () => {
    if (!usage) return;
    const lines = ['event_type,count'];
    for (const [eventType, count] of Object.entries(usage.breakdownByType)) {
      lines.push(`${eventType},${count}`);
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'usage-breakdown.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const overLimitActive =
    usage &&
    (usage.overLimit.programs ||
      usage.overLimit.aiRequests ||
      usage.overLimit.storageGb ||
      usage.overLimit.teamSeats);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Usage Details</h1>
        <p className="text-gray-600">Track your monthly usage and activity</p>
      </div>

      {overLimitActive && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">You are above one or more plan limits this period.</p>
          <p className="mt-1">This is a soft warning only — your account remains fully functional.</p>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm mb-8 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Billing Period</h2>
            <p className="text-gray-600">{usage?.period.label ?? (loading ? 'Loading…' : '—')}</p>
          </div>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-600">PLC Programs</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900 mb-1">{usage?.used.programs ?? 0}</p>
          <p className="text-sm text-gray-500">of {usage?.limits.programsPerMonth ?? '—'} limit</p>
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full"
                style={{ width: `${usage?.percentages.programs ?? 0}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-600">AI Requests</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900 mb-1">{usage?.used.aiRequests ?? 0}</p>
          <p className="text-sm text-gray-500">of {usage?.limits.aiRequestsPerMonth ?? '—'} limit</p>
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-600 h-2 rounded-full"
                style={{ width: `${usage?.percentages.aiRequests ?? 0}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-600">Storage Used</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900 mb-1">{usage?.used.storageGb ?? 0} GB</p>
          <p className="text-sm text-gray-500">of {usage?.limits.storageGb ?? '—'} GB limit</p>
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-orange-600 h-2 rounded-full"
                style={{ width: `${usage?.percentages.storageGb ?? 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm mb-8">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">PLC Programs Generated</h2>
          <p className="text-gray-600 mt-1">Daily program generation activity</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Count</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(usage?.recentPrograms ?? []).length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-sm text-gray-500">
                    {loading ? 'Loading…' : 'No program activity in this period.'}
                  </td>
                </tr>
              ) : (
                usage?.recentPrograms.map((item, index) => (
                  <tr key={`${item.date}-${index}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.date}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{item.label}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                      {item.count} programs
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm mb-8">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">AI Generation Requests</h2>
          <p className="text-gray-600 mt-1">AI assistance usage breakdown</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requests</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(usage?.recentAiRequests ?? []).length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-sm text-gray-500">
                    {loading ? 'Loading…' : 'No AI activity in this period.'}
                  </td>
                </tr>
              ) : (
                usage?.recentAiRequests.map((item, index) => (
                  <tr key={`${item.date}-${item.label}-${index}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.date}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{item.label}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                      {item.count} requests
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg shadow-sm p-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Export Usage Data</h3>
          <p className="text-sm text-gray-600">Download event breakdown for this period</p>
        </div>
        <button
          onClick={exportCsv}
          disabled={!usage}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Export CSV
        </button>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/billing/plan"
          className="block p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-500 transition-colors"
        >
          <h3 className="font-medium text-gray-900 mb-1">View Plan Details</h3>
          <p className="text-sm text-gray-600">Check your current plan and limits</p>
        </Link>
        <Link
          href="/billing/upgrade"
          className="block p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-500 transition-colors"
        >
          <h3 className="font-medium text-gray-900 mb-1">Upgrade Plan</h3>
          <p className="text-sm text-gray-600">Increase your limits and features</p>
        </Link>
      </div>
    </div>
  );
}
