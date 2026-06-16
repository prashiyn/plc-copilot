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

  useEffect(() => {
    fetch('/api/templates')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setTemplates(data?.templates ?? []))
      .catch(() => setTemplates([]))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Project Templates</h1>
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
                <div className="mt-4">
                  <Link
                    href={t.generatorUrl}
                    className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    Use Template
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
