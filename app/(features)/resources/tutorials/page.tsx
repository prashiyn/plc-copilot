'use client';

import React, { useEffect, useState } from 'react';

interface Tutorial {
  slug: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: string;
  instructor: string;
}

const THUMBNAILS = [
  'bg-gradient-to-br from-blue-500 to-purple-600',
  'bg-gradient-to-br from-green-500 to-teal-600',
  'bg-gradient-to-br from-orange-500 to-red-600',
  'bg-gradient-to-br from-pink-500 to-rose-600',
  'bg-gradient-to-br from-indigo-500 to-blue-600',
  'bg-gradient-to-br from-yellow-500 to-orange-600',
];

const categories = [
  { id: 'all', name: 'All Tutorials' },
  { id: 'getting-started', name: 'Getting Started' },
  { id: 'plc-platforms', name: 'PLC Platforms' },
  { id: 'ai-features', name: 'AI Features' },
  { id: 'api', name: 'API Integration' },
  { id: 'best-practices', name: 'Best Practices' },
  { id: 'troubleshooting', name: 'Troubleshooting' },
];

const difficulties = [
  { id: 'all', name: 'All Levels' },
  { id: 'beginner', name: 'Beginner' },
  { id: 'intermediate', name: 'Intermediate' },
  { id: 'advanced', name: 'Advanced' },
];

export default function TutorialsPage() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedCategory !== 'all') params.set('category', selectedCategory);
    if (selectedDifficulty !== 'all') params.set('difficulty', selectedDifficulty);

    setIsLoading(true);
    fetch(`/api/resources/tutorials?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setTutorials(data.tutorials ?? []);
          setTotal(data.total ?? 0);
        }
      })
      .catch(() => setTutorials([]))
      .finally(() => setIsLoading(false));
  }, [selectedCategory, selectedDifficulty]);

  const getDifficultyColor = (difficulty: string) => {
    const colors = {
      beginner: 'bg-green-100 text-green-800',
      intermediate: 'bg-yellow-100 text-yellow-800',
      advanced: 'bg-red-100 text-red-800',
    };
    return colors[difficulty as keyof typeof colors] || colors.beginner;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Video Tutorials</h1>
        <p className="text-gray-600">Learn PLCAutoPilot with step-by-step video guides</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Total Tutorials</h3>
          <p className="text-3xl font-bold text-gray-900">{total}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Showing</h3>
          <p className="text-3xl font-bold text-gray-900">{tutorials.length}</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty</label>
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {difficulties.map((diff) => (
                <option key={diff.id} value={diff.id}>{diff.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <p className="text-gray-600">Loading tutorials...</p>
      ) : tutorials.length === 0 ? (
        <p className="text-gray-600">No tutorials match your filters.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tutorials.map((tutorial, index) => (
            <div
              key={tutorial.slug}
              className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden hover:shadow-lg transition-shadow"
            >
              <div className={`${THUMBNAILS[index % THUMBNAILS.length]} h-48 flex items-center justify-center relative`}>
                <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center">
                  <div className="w-16 h-16 bg-white bg-opacity-90 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-900 ml-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
                <div className="absolute top-3 right-3 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-sm font-medium">
                  {tutorial.duration}
                </div>
              </div>

              <div className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getDifficultyColor(tutorial.difficulty)}`}>
                    {tutorial.difficulty.charAt(0).toUpperCase() + tutorial.difficulty.slice(1)}
                  </span>
                  <span className="text-xs text-gray-500">{tutorial.category.replace('-', ' ')}</span>
                </div>

                <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2">{tutorial.title}</h3>
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">{tutorial.description}</p>

                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                  <span>{tutorial.instructor}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
