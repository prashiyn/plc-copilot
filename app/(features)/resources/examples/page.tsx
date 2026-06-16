'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

interface Template {
  id: string;
  name: string;
  description: string;
  pattern: string;
  defaultPlatform: string;
  defaultController: string;
  industry: string;
  complexity: string;
  logicDescription: string;
  generatorUrl: string;
}

const platforms = [
  { id: 'all', name: 'All Platforms' },
  { id: 'siemens', name: 'Siemens' },
  { id: 'rockwell', name: 'Rockwell/Allen-Bradley' },
  { id: 'schneider', name: 'Schneider' },
  { id: 'mitsubishi', name: 'Mitsubishi' },
];

export default function ExamplesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/templates')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setTemplates(data?.templates ?? []))
      .catch(() => setTemplates([]))
      .finally(() => setIsLoading(false));
  }, []);

  const filteredExamples = templates.filter(
    (t) => selectedPlatform === 'all' || t.defaultPlatform === selectedPlatform,
  );

  const platformSet = new Set(templates.map((t) => t.defaultPlatform));

  const getPlatformColor = (platform: string) => {
    const colors: Record<string, string> = {
      siemens: 'bg-blue-100 text-blue-800',
      rockwell: 'bg-red-100 text-red-800',
      mitsubishi: 'bg-green-100 text-green-800',
      schneider: 'bg-purple-100 text-purple-800',
    };
    return colors[platform] || 'bg-gray-100 text-gray-800';
  };

  const getComplexityColor = (complexity: string) => {
    const lower = complexity.toLowerCase();
    const colors: Record<string, string> = {
      simple: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      advanced: 'bg-red-100 text-red-800',
    };
    return colors[lower] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Code Examples</h1>
        <p className="text-gray-600">Ready-to-use PLC programs for common automation tasks</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Total Examples</h3>
          <p className="text-3xl font-bold text-gray-900">{templates.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Platforms</h3>
          <p className="text-3xl font-bold text-gray-900">{platformSet.size}</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 mb-8">
        <label className="block text-sm font-medium text-gray-700 mb-2">Platform</label>
        <select
          value={selectedPlatform}
          onChange={(e) => setSelectedPlatform(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {platforms.map((platform) => (
            <option key={platform.id} value={platform.id}>{platform.name}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <p className="text-gray-600">Loading examples...</p>
      ) : filteredExamples.length === 0 ? (
        <p className="text-gray-600">No examples match your filter.</p>
      ) : (
        <div className="space-y-4">
          {filteredExamples.map((example) => (
            <div
              key={example.id}
              className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md hover:border-blue-500 transition-all"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-gray-900">{example.name}</h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getComplexityColor(example.complexity)}`}>
                        {example.complexity}
                      </span>
                    </div>
                    <p className="text-gray-600 mb-3">{example.description}</p>
                    <div className="flex items-center gap-4 text-sm">
                      <span className={`px-3 py-1 rounded-full font-medium ${getPlatformColor(example.defaultPlatform)}`}>
                        {platforms.find((p) => p.id === example.defaultPlatform)?.name ?? example.defaultPlatform}
                      </span>
                      <span className="text-gray-600">{example.defaultController}</span>
                      <span className="text-gray-600">{example.pattern}</span>
                    </div>
                  </div>
                  <Link
                    href={example.generatorUrl}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium whitespace-nowrap"
                  >
                    Use Template
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
