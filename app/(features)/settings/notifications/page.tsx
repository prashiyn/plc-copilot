'use client';

import React, { useEffect, useState } from 'react';

type ChannelPrefs = { email: boolean; push: boolean; sms: boolean };
type NotificationSettings = Record<string, ChannelPrefs>;

const categories = [
  {
    id: 'programs',
    name: 'PLC Programs',
    description: 'Notifications about your PLC program generation',
    items: [
      { key: 'programGenerated', label: 'Program Generated Successfully', description: 'When a new PLC program is generated' },
      { key: 'programFailed', label: 'Program Generation Failed', description: 'When program generation encounters an error' },
    ],
  },
  {
    id: 'team',
    name: 'Team & Collaboration',
    description: 'Updates about your team members and shared projects',
    items: [
      { key: 'teamInvite', label: 'Team Invitations', description: 'When someone invites you to their team' },
    ],
  },
  {
    id: 'billing',
    name: 'Billing & Usage',
    description: 'Important updates about your subscription and usage',
    items: [
      { key: 'billingIssue', label: 'Billing Issues', description: 'Payment failures or subscription problems' },
      { key: 'usageAlert', label: 'Usage Alerts', description: 'When approaching plan limits' },
      { key: 'weeklyReport', label: 'Weekly Usage Report', description: 'Weekly summary of your activity' },
    ],
  },
  {
    id: 'system',
    name: 'System & Security',
    description: 'Platform updates and security notifications',
    items: [
      { key: 'productUpdates', label: 'Product Updates', description: 'New features and improvements' },
      { key: 'securityAlerts', label: 'Security Alerts', description: 'Important security notifications' },
    ],
  },
];

export default function NotificationsPage() {
  const [settings, setSettings] = useState<NotificationSettings>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/settings/notifications')
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to load notification settings');
        }
        return res.json();
      })
      .then((data) => {
        if (data.notifications) setSettings(data.notifications);
      })
      .catch((err) => {
        setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load settings' });
      })
      .finally(() => setIsLoading(false));
  }, []);

  const toggleNotification = (key: string, type: 'email' | 'push' | 'sms') => {
    const current = settings[key] ?? { email: false, push: false, sms: false };
    setSettings({
      ...settings,
      [key]: { ...current, [type]: !current[type] },
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/settings/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notifications: settings }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save settings');
      if (data.notifications) setSettings(data.notifications);
      setMessage({ type: 'success', text: 'Notification preferences saved successfully' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save settings' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <p className="text-gray-600">Loading notification settings...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Notification Settings</h1>
        <p className="text-gray-600">Manage how you receive notifications</p>
      </div>

      {message && (
        <div
          className={`mb-6 px-4 py-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Email</h3>
              <p className="text-sm text-gray-600">Account email</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Push</h3>
              <p className="text-sm text-gray-600">Browser notifications</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">SMS</h3>
              <p className="text-sm text-gray-600">Text message alerts</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {categories.map((category) => (
          <div key={category.id} className="bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">{category.name}</h3>
              <p className="text-sm text-gray-600">{category.description}</p>
            </div>
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="pb-3 text-left text-sm font-medium text-gray-700">Notification</th>
                      <th className="pb-3 text-center text-sm font-medium text-gray-700">Email</th>
                      <th className="pb-3 text-center text-sm font-medium text-gray-700">Push</th>
                      <th className="pb-3 text-center text-sm font-medium text-gray-700">SMS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {category.items.map((item) => {
                      const prefs = settings[item.key] ?? { email: false, push: false, sms: false };
                      return (
                        <tr key={item.key}>
                          <td className="py-4">
                            <p className="font-medium text-gray-900">{item.label}</p>
                            <p className="text-sm text-gray-600">{item.description}</p>
                          </td>
                          {(['email', 'push', 'sms'] as const).map((channel) => (
                            <td key={channel} className="py-4 text-center">
                              <button
                                type="button"
                                onClick={() => toggleNotification(item.key, channel)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                  prefs[channel] ? 'bg-blue-600' : 'bg-gray-200'
                                }`}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    prefs[channel] ? 'translate-x-6' : 'translate-x-1'
                                  }`}
                                />
                              </button>
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex justify-end gap-3">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400"
        >
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
