'use client';

import { useEffect, useMemo, useState } from 'react';

interface Project {
  id: string;
  name: string;
  status: string;
}

interface ProjectSelectorProps {
  value: string | null;
  onChange: (projectId: string | null) => void;
  label?: string;
}

let cachedProjects: Project[] | null = null;

export default function ProjectSelector({ value, onChange, label = 'Save to project' }: ProjectSelectorProps) {
  const [projects, setProjects] = useState<Project[]>(cachedProjects ?? []);
  const [loading, setLoading] = useState(!cachedProjects);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const activeProjects = useMemo(
    () => projects.filter((p) => p.status !== 'completed' && p.status !== 'archived'),
    [projects],
  );

  const loadProjects = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/projects');
      if (!res.ok) {
        setProjects([]);
        cachedProjects = [];
        return;
      }
      const data = await res.json();
      const rows = Array.isArray(data.projects) ? (data.projects as Project[]) : [];
      setProjects(rows);
      cachedProjects = rows;
    } catch {
      setError('Could not load projects.');
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!cachedProjects) loadProjects();
  }, []);

  const createProject = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, status: 'in_progress' }),
      });
      if (!res.ok) {
        setError('Could not create project.');
        return;
      }
      const data = await res.json();
      const project = data.project as Project | undefined;
      if (!project) return;
      const next = [project, ...projects];
      setProjects(next);
      cachedProjects = next;
      onChange(project.id);
      setShowCreate(false);
      setNewName('');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
      <div className="flex gap-2">
        <select
          value={value ?? ''}
          onChange={(e) => {
            const nextValue = e.target.value;
            if (nextValue === '__new__') {
              setShowCreate(true);
              return;
            }
            onChange(nextValue || null);
          }}
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
          disabled={loading}
        >
          <option value="">{loading ? 'Loading projects...' : 'No project'}</option>
          {activeProjects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
          <option value="__new__">Create new...</option>
        </select>
        <button
          type="button"
          onClick={loadProjects}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}

      {showCreate ? (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-lg shadow-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Create Project</h3>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Project name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={createProject}
                disabled={creating || !newName.trim()}
                className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white disabled:bg-gray-400"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
