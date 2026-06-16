'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

interface Template {
  id: string;
  name: string;
  description: string;
  industry: string;
  complexity: string;
  defaultPlatform: string;
  generatorUrl: string;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [usingId, setUsingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/templates')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setTemplates(data?.templates ?? []))
      .catch(() => setTemplates([]))
      .finally(() => setIsLoading(false));
  }, []);

  const useTemplate = async (templateId: string) => {
    setUsingId(templateId);
    setError('');
    const res = await fetch('/api/projects/from-template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Could not create project from template.');
      setUsingId(null);
      return;
    }
    const data = await res.json();
    if (data.project?.id) {
      window.location.href = `/projects/${data.project.id}?tab=overview&newFromTemplate=1`;
      return;
    }
    setError('Could not create project from template.');
    setUsingId(null);
  };

  return (
    <div className="py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-6">
          <h1 className="text-3xl font-bold">Project Templates</h1>
          <Link
            href="/projects"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            ← My projects
          </Link>
        </div>
        {error ? <p className="text-sm text-red-600 mb-4">{error}</p> : null}
        {isLoading ? (
          <p className="text-gray-600">Loading templates...</p>
        ) : templates.length === 0 ? (
          <p className="text-gray-600">No templates available.</p>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            {templates.map((t) => (
              <div key={t.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                <h3 className="font-bold text-lg">{t.name}</h3>
                <p className="text-sm text-gray-600 mt-2">{t.description}</p>
                <p className="text-sm text-gray-500 mt-1">{t.industry}</p>
                <span className="inline-block mt-3 px-3 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                  {t.complexity}
                </span>
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => useTemplate(t.id)}
                    disabled={usingId !== null}
                    className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:bg-gray-400"
                  >
                    {usingId === t.id ? 'Creating project…' : 'Use Template'}
                  </button>
                  <Link
                    href={t.generatorUrl}
                    className="inline-block text-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                  >
                    Open generator only
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
