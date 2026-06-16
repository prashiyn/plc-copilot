'use client';

import React, { useEffect, useState } from 'react';

interface ForumThread {
  id: string;
  title: string;
  category: string;
  authorName: string;
  isPinned: boolean;
  status: string;
  replies: number;
  createdAt: string | null;
  updatedAt: string | null;
}

const categories = [
  { id: 'all', name: 'All Topics', color: 'bg-gray-100 text-gray-800' },
  { id: 'general', name: 'General Discussion', color: 'bg-blue-100 text-blue-800' },
  { id: 'help', name: 'Help & Support', color: 'bg-green-100 text-green-800' },
  { id: 'feature-requests', name: 'Feature Requests', color: 'bg-purple-100 text-purple-800' },
  { id: 'bug-reports', name: 'Bug Reports', color: 'bg-red-100 text-red-800' },
  { id: 'showcase', name: 'Showcase', color: 'bg-orange-100 text-orange-800' },
];

function authorInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function formatRelative(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export default function ForumPage() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewTopic, setShowNewTopic] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [newTopic, setNewTopic] = useState({ title: '', category: 'general', body: '' });

  const loadThreads = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/forum/threads');
      if (!res.ok) throw new Error('Failed to load threads');
      const data = await res.json();
      setThreads(data.threads ?? []);
    } catch {
      setThreads([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadThreads();
  }, []);

  const categoryCounts = categories.map((cat) => ({
    ...cat,
    count: cat.id === 'all'
      ? threads.length
      : threads.filter((t) => t.category === cat.id).length,
  }));

  const visibleThreads = selectedCategory === 'all'
    ? threads
    : threads.filter((t) => t.category === selectedCategory);

  const pinnedThreads = visibleThreads.filter((t) => t.isPinned);
  const regularThreads = visibleThreads.filter((t) => !t.isPinned);
  const solvedCount = threads.filter((t) => t.status === 'solved').length;
  const totalReplies = threads.reduce((sum, t) => sum + t.replies, 0);

  const getCategoryColor = (categoryId: string) => {
    return categories.find((c) => c.id === categoryId)?.color || 'bg-gray-100 text-gray-800';
  };

  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/forum/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTopic),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setMessage({ type: 'error', text: 'Please sign in to create a new topic.' });
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Failed to create topic');

      setMessage({ type: 'success', text: 'Topic created successfully.' });
      setNewTopic({ title: '', category: 'general', body: '' });
      setShowNewTopic(false);
      await loadThreads();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to create topic' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderThread = (thread: ForumThread, pinned: boolean) => (
    <div
      key={thread.id}
      className={`rounded-lg p-6 hover:shadow-md transition-shadow ${
        pinned
          ? 'bg-blue-50 border-2 border-blue-200'
          : 'bg-white border border-gray-200 hover:border-blue-500'
      }`}
    >
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 ${pinned ? 'bg-blue-600' : 'bg-gray-600'} text-white rounded-full flex items-center justify-center font-semibold flex-shrink-0`}>
          {authorInitials(thread.authorName)}
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{thread.title}</h3>
          <div className="flex items-center gap-3 text-sm text-gray-600 mb-3">
            <span>{thread.authorName}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(thread.category)}`}>
              {categories.find((c) => c.id === thread.category)?.name}
            </span>
            {thread.status === 'solved' && (
              <span className="flex items-center gap-1 text-green-600 text-xs font-medium">Solved</span>
            )}
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <span>{thread.replies} replies</span>
            <span className="ml-auto">{formatRelative(thread.updatedAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Community Forum</h1>
            <p className="text-gray-600">Connect with other PLC developers and get help</p>
          </div>
          <button
            onClick={() => setShowNewTopic(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            New Topic
          </button>
        </div>
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Total Topics</h3>
          <p className="text-3xl font-bold text-gray-900">{threads.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Total Replies</h3>
          <p className="text-3xl font-bold text-gray-900">{totalReplies}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Solved</h3>
          <p className="text-3xl font-bold text-gray-900">{solvedCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1">
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 sticky top-8">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Categories</h3>
            <nav className="space-y-2">
              {categoryCounts.map((category) => (
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

        <div className="lg:col-span-3 space-y-6">
          {isLoading ? (
            <p className="text-gray-600">Loading threads...</p>
          ) : visibleThreads.length === 0 ? (
            <p className="text-gray-600">No topics yet. Be the first to start a discussion.</p>
          ) : (
            <>
              {pinnedThreads.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Pinned Topics</h2>
                  <div className="space-y-3">
                    {pinnedThreads.map((thread) => renderThread(thread, true))}
                  </div>
                </div>
              )}
              <div>
                {pinnedThreads.length > 0 && (
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Topics</h2>
                )}
                <div className="space-y-3">
                  {regularThreads.map((thread) => renderThread(thread, false))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {showNewTopic && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">New Topic</h3>
              <button onClick={() => setShowNewTopic(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateTopic} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                <input
                  type="text"
                  required
                  value={newTopic.title}
                  onChange={(e) => setNewTopic({ ...newTopic, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select
                  value={newTopic.category}
                  onChange={(e) => setNewTopic({ ...newTopic, category: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {categories.filter((c) => c.id !== 'all').map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Body</label>
                <textarea
                  required
                  value={newTopic.body}
                  onChange={(e) => setNewTopic({ ...newTopic, body: e.target.value })}
                  rows={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowNewTopic(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400"
                >
                  {isSubmitting ? 'Posting...' : 'Post Topic'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
