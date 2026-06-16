'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface DocArticle {
  slug: string;
  title: string;
  description: string;
  category: string;
  readTime: string;
  updated: string;
  popular: boolean;
  content: string;
}

export default function DocArticlePage() {
  const params = useParams();
  const slug = params.slug as string;
  const [article, setArticle] = useState<DocArticle | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    setIsLoading(true);
    fetch(`/api/resources/docs/${encodeURIComponent(slug)}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Article not found');
        }
        return res.json();
      })
      .then((data) => setArticle(data.article))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load article'))
      .finally(() => setIsLoading(false));
  }, [slug]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <p className="text-gray-600">Loading article...</p>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <p className="text-red-600 mb-4">{error || 'Article not found'}</p>
        <Link href="/resources/docs" className="text-blue-600 hover:text-blue-700">
          Back to documentation
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link href="/resources/docs" className="text-blue-600 hover:text-blue-700 text-sm mb-4 inline-block">
        &larr; Back to documentation
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{article.title}</h1>
        <p className="text-gray-600 mb-4">{article.description}</p>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>{article.readTime} read</span>
          <span>Updated {article.updated}</span>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
        <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">
          {article.content}
        </pre>
      </div>
    </div>
  );
}
