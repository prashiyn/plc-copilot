'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { PlcDownloadParams } from '@/lib/plc-generation';

interface StoredProgram {
  id: string;
  fileName: string | null;
  programFormat: string | null;
  programCode: string;
  createdAt: string | null;
  generationParameters: {
    manufacturer?: string;
    model?: string;
    pattern?: string;
    generationPath?: string;
    downloadParams?: PlcDownloadParams;
  } | null;
}

export default function ProgramsPage() {
  const [programs, setPrograms] = useState<StoredProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    const res = await fetch('/api/programs');
    if (res.status === 401) {
      setError('Sign in to view your generated programs.');
      setPrograms([]);
      setLoading(false);
      return;
    }
    if (!res.ok) {
      setError('Could not load programs.');
      setLoading(false);
      return;
    }
    const data = await res.json();
    setPrograms(data.programs ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const redownload = async (program: StoredProgram) => {
    const params = program.generationParameters?.downloadParams;
    if (!params) return;
    setDownloadingId(program.id);
    try {
      const res = await fetch('/api/download-program', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Download failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = program.fileName || `program.${program.programFormat || 'bin'}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Generated Programs</h1>
            <p className="text-gray-600 mt-1">
              Programs saved when you generate while signed in.
            </p>
          </div>
          <Link
            href="/generator"
            className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            New generation
          </Link>
        </div>

        {loading ? (
          <p className="text-gray-500">Loading programs…</p>
        ) : error ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-900">
            {error}{' '}
            {error.includes('Sign in') && (
              <Link href="/login" className="underline font-medium">
                Sign in
              </Link>
            )}
          </div>
        ) : programs.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-12 text-center">
            <p className="text-gray-600 mb-4">No saved programs yet.</p>
            <Link href="/generator" className="text-blue-600 font-medium hover:underline">
              Generate your first program
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-4 font-semibold text-gray-700">File</th>
                  <th className="text-left p-4 font-semibold text-gray-700">PLC</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Pattern</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Path</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Created</th>
                  <th className="text-right p-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {programs.map((program) => {
                  const params = program.generationParameters;
                  const canRedownload = !!params?.downloadParams;
                  return (
                    <tr key={program.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-4 font-medium text-gray-900">
                        {program.fileName || 'Untitled'}
                        {program.programFormat && (
                          <span className="ml-2 text-xs text-gray-500">.{program.programFormat}</span>
                        )}
                      </td>
                      <td className="p-4 text-gray-700">
                        {params?.manufacturer && params?.model
                          ? `${params.manufacturer} — ${params.model}`
                          : '—'}
                      </td>
                      <td className="p-4 text-gray-700">{params?.pattern ?? '—'}</td>
                      <td className="p-4 text-gray-700">{params?.generationPath ?? '—'}</td>
                      <td className="p-4 text-gray-700">
                        {program.createdAt
                          ? new Date(program.createdAt).toLocaleString()
                          : '—'}
                      </td>
                      <td className="p-4 text-right space-x-2">
                        <details className="inline-block text-left">
                          <summary className="cursor-pointer text-blue-600 hover:underline">
                            Preview
                          </summary>
                          <pre className="mt-2 max-w-md max-h-48 overflow-auto text-xs bg-gray-900 text-green-400 p-3 rounded-lg whitespace-pre-wrap">
                            {program.programCode.slice(0, 4000)}
                            {program.programCode.length > 4000 ? '\n…' : ''}
                          </pre>
                        </details>
                        {canRedownload && (
                          <button
                            type="button"
                            onClick={() => redownload(program)}
                            disabled={downloadingId === program.id}
                            className="ml-2 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                          >
                            {downloadingId === program.id ? '…' : 'Download'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
