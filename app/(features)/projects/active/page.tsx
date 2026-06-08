'use client';

import { useEffect, useState } from 'react';

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
};

export default function ActiveProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [plcModel, setPlcModel] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/projects');
    if (res.ok) {
      const data = await res.json();
      // Active = anything not completed/archived.
      setProjects(
        (data.projects as Project[]).filter(
          (p) => p.status !== 'completed' && p.status !== 'archived',
        ),
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

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
    setName('');
    setPlcModel('');
    load();
  };

  const completeProject = async (id: string) => {
    await fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });
    load();
  };

  const deleteProject = async (id: string) => {
    await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Active Projects</h1>

        {/* New project */}
        <form
          onSubmit={createProject}
          className="bg-white rounded-lg shadow-md p-4 mb-6 flex flex-col sm:flex-row gap-3"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New project name"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            required
          />
          <input
            value={plcModel}
            onChange={(e) => setPlcModel(e.target.value)}
            placeholder="PLC model (optional)"
            className="sm:w-56 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={creating}
            className="px-5 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:bg-gray-400"
          >
            {creating ? 'Adding...' : 'Add Project'}
          </button>
        </form>
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : projects.length === 0 ? (
          <p className="text-gray-500">No active projects yet. Add one above to get started.</p>
        ) : (
          <div className="grid gap-4">
            {projects.map((p) => (
              <div key={p.id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-lg">{p.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {STATUS_LABELS[p.status] ?? p.status}
                      {p.plcModel ? ` · ${p.plcModel}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => completeProject(p.id)}
                      className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors"
                    >
                      Mark Complete
                    </button>
                    <button
                      onClick={() => deleteProject(p.id)}
                      className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
