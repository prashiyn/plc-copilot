'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Project {
  id: string;
  name: string;
  description: string | null;
  plcManufacturer: string | null;
  plcModel: string | null;
  status: string;
  updatedAt: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  in_progress: 'In Progress',
  testing: 'Testing',
  completed: 'Completed',
  archived: 'Archived',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  testing: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  archived: 'bg-red-100 text-red-700',
};

export default function ProjectsLandingPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [plcModel, setPlcModel] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/projects');
    if (res.ok) {
      const data = await res.json();
      setProjects(data.projects ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const activeProjects = projects.filter(
    (p) => p.status !== 'completed' && p.status !== 'archived',
  );
  const completedProjects = projects.filter((p) => p.status === 'completed');

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError('');
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, plcModel, status: 'in_progress' }),
    });
    setCreating(false);
    if (!res.ok) {
      setError('Could not create project.');
      return;
    }
    const data = await res.json();
    setShowModal(false);
    setName('');
    setPlcModel('');
    if (data.project?.id) {
      window.location.href = `/projects/${data.project.id}`;
      return;
    }
    load();
  };

  return (
    <div className="py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Projects</h1>
            <p className="text-gray-600 mt-1">
              Your automation workspaces — programs, files, chats, and more.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/projects/templates"
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Browse templates
            </Link>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
            >
              New project
            </button>
          </div>
        </div>

        <section className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Active Projects</h2>
          {loading ? (
            <p className="text-gray-500">Loading...</p>
          ) : activeProjects.length === 0 ? (
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center text-gray-500">
              <p className="mb-2">No active projects yet.</p>
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="text-green-700 font-medium hover:underline"
              >
                Create your first project
              </button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {activeProjects.map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow block"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-lg text-gray-900">{p.name}</h3>
                      {p.description ? (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{p.description}</p>
                      ) : null}
                      <p className="text-sm text-gray-500 mt-2">
                        {p.plcManufacturer ? `${p.plcManufacturer} ` : ''}
                        {p.plcModel ?? ''}
                      </p>
                    </div>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[p.status] ?? 'bg-gray-100 text-gray-700'}`}>
                      {STATUS_LABELS[p.status] ?? p.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Completed</h2>
          {loading ? (
            <p className="text-gray-500">Loading...</p>
          ) : completedProjects.length === 0 ? (
            <p className="text-gray-500 text-sm">No completed projects yet.</p>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y">
              {completedProjects.map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p className="font-medium text-gray-900">{p.name}</p>
                    <p className="text-sm text-gray-500">{p.plcModel ?? 'No PLC model'}</p>
                  </div>
                  <span className="text-xs text-gray-400">
                    {p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : ''}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      {showModal ? (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-lg shadow-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">New Project</h3>
            <form onSubmit={createProject} className="space-y-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Project name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              />
              <input
                value={plcModel}
                onChange={(e) => setPlcModel(e.target.value)}
                placeholder="PLC model (optional)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm disabled:bg-gray-400"
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
