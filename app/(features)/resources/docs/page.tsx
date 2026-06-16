'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

interface DocArticle {
  slug: string;
  title: string;
  description: string;
  category: string;
  readTime: string;
  updated: string;
  popular: boolean;
}

interface DocCategory {
  id: string;
  name: string;
  count: number;
}

export default function DocsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [docs, setDocs] = useState<DocArticle[]>([]);
  const [categories, setCategories] = useState<DocCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (selectedCategory !== 'all') params.set('category', selectedCategory);

    setIsLoading(true);
    fetch(`/api/resources/docs?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setDocs(data.docs ?? []);
          setCategories(data.categories ?? []);
        }
      })
      .catch(() => {
        setDocs([]);
        setCategories([]);
      })
      .finally(() => setIsLoading(false));
  }, [searchQuery, selectedCategory]);

  const popularDocs = docs.filter((doc) => doc.popular).slice(0, 5);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Documentation</h1>
        <p className="text-gray-600">Comprehensive guides and references for PLCAutoPilot</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 mb-8">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documentation..."
            className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <svg
            className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {popularDocs.length > 0 && (
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold mb-4">Popular Documentation</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {popularDocs.map((doc) => (
              <Link
                key={doc.slug}
                href={`/resources/docs/${doc.slug}`}
                className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-4 hover:bg-opacity-20 transition-all"
              >
                <h3 className="font-semibold mb-2">{doc.title}</h3>
                <p className="text-sm text-blue-100">{doc.readTime} read</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1">
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 sticky top-8">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Categories</h3>
            <nav className="space-y-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setSelectedCategory(category.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                    selectedCategory === category.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-sm font-medium">{category.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    selectedCategory === category.id
                      ? 'bg-blue-200 text-blue-800'
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {category.count}
                  </span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        <div className="lg:col-span-3">
          {isLoading ? (
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-12 text-center text-gray-600">
              Loading documentation...
            </div>
          ) : docs.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-12 text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No documentation found</h3>
              <p className="text-gray-600">Try adjusting your search or category filter</p>
            </div>
          ) : (
            <div className="space-y-4">
              {docs.map((doc) => (
                <Link
                  key={doc.slug}
                  href={`/resources/docs/${doc.slug}`}
                  className="block bg-white border border-gray-200 rounded-lg shadow-sm p-6 hover:border-blue-500 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{doc.title}</h3>
                        {doc.popular && (
                          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                            Popular
                          </span>
                        )}
                      </div>
                      <p className="text-gray-600 mb-3">{doc.description}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>{doc.readTime}</span>
                        <span>Updated {doc.updated}</span>
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full">
                          {categories.find((c) => c.id === doc.category)?.name ?? doc.category}
                        </span>
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-gray-400 flex-shrink-0 ml-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
