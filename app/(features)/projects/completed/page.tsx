'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Project {
  id: string;
  name: string;
  plcModel: string | null;
  plcManufacturer: string | null;
  applicationType: string | null;
  updatedAt: string | null;
}

export default function CompletedProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/projects?status=completed');
    if (res.ok) setProjects((await res.json()).projects);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const reopen = async (id: string) => {
    await fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' }),
    });
    load();
  };

  const remove = async (id: string) => {
    await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    load();
  };

  const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString() : '—');

  return (
    <div className="py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Completed Projects</h1>
            <p className="text-gray-600 mt-1">View and export your finished PLC projects</p>
          </div>
          <Link
            href="/sap/export"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            Export to SAP
          </Link>
        </div>

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : projects.length === 0 ? (
          <p className="text-gray-500">No completed projects yet.</p>
        ) : (
          <div className="grid gap-4">
            {projects.map((p) => (
              <div key={p.id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-gray-900">{p.name}</h3>
                    {p.applicationType && (
                      <p className="text-sm text-gray-600 mt-1">Type: {p.applicationType}</p>
                    )}
                    <p className="text-sm text-gray-600 mt-1">
                      PLC: {[p.plcManufacturer, p.plcModel].filter(Boolean).join(' ') || '—'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Completed: {fmtDate(p.updatedAt)}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => reopen(p.id)}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                    >
                      Reopen
                    </button>
                    <Link
                      href={`/sap/export?project=${p.id}`}
                      className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors text-center"
                    >
                      Export to SAP
                    </Link>
                    <button
                      onClick={() => remove(p.id)}
                      className="px-4 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
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
