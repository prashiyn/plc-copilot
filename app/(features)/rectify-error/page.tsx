'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle, Wrench } from 'lucide-react';
import ProjectSelector from '@/lib/components/ProjectSelector';

interface RectifyAnalysis {
  errorType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedComponents: string[];
  rootCause: string;
}

interface RectifySolution {
  description: string;
  correctedCode: string;
  explanation: string;
  confidence: number;
}

interface RectifyResponse {
  success: boolean;
  analysis: RectifyAnalysis;
  solutions: RectifySolution[];
  recommendations: string[];
  source?: 'ai' | 'fallback';
}

const PLATFORMS = [
  { id: 'schneider', label: 'Schneider Electric' },
  { id: 'siemens', label: 'Siemens' },
  { id: 'rockwell', label: 'Rockwell / Allen-Bradley' },
  { id: 'mitsubishi', label: 'Mitsubishi' },
];

export default function RectifyErrorPage() {
  const [programCode, setProgramCode] = useState('');
  const [platform, setPlatform] = useState('schneider');
  const [plcModel, setPlcModel] = useState('TM221CE16T');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RectifyResponse | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!programCode.trim() || !errorMessage.trim()) {
      setError('Program code and error message are required.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/rectify-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ programCode, platform, errorMessage, plcModel, projectId }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Rectification request failed');
      }

      setResult(data as RectifyResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-red-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Wrench className="text-amber-600" size={32} />
            Error Rectification
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            Paste compiler/IDE errors and program code for AI analysis and suggested fixes.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <ProjectSelector value={projectId} onChange={setProjectId} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Platform
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-600"
              >
                {PLATFORMS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                PLC model
              </label>
              <input
                type="text"
                value={plcModel}
                onChange={(e) => setPlcModel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-600"
                placeholder="e.g. TM221CE16T"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Error message
            </label>
            <textarea
              value={errorMessage}
              onChange={(e) => setErrorMessage(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm dark:bg-gray-800 dark:border-gray-600"
              placeholder="e.g. Timer format invalid for PT:=100"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Program code
            </label>
            <textarea
              value={programCode}
              onChange={(e) => setProgramCode(e.target.value)}
              rows={12}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm dark:bg-gray-800 dark:border-gray-600"
              placeholder="Paste IEC 61131-3 or ladder logic here..."
              required
            />
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-start gap-2">
              <AlertTriangle size={20} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
          >
            {loading ? 'Analyzing...' : 'Analyze & suggest fixes'}
          </button>
        </form>

        {result && (
          <div className="mt-10 space-y-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="text-green-600" size={24} />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Analysis</h2>
              {result.source && (
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium ${
                    result.source === 'ai'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {result.source === 'ai' ? 'Claude' : 'Rule-based fallback'}
                </span>
              )}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <p className="font-medium text-gray-900 dark:text-white">{result.analysis.errorType}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Severity: {result.analysis.severity} · {result.analysis.rootCause}
              </p>
              {result.analysis.affectedComponents?.length > 0 && (
                <p className="text-sm text-gray-500 mt-2">
                  Affected: {result.analysis.affectedComponents.join(', ')}
                </p>
              )}
            </div>

            {result.solutions.map((solution, idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6"
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-gray-900 dark:text-white">{solution.description}</h3>
                  <span className="text-sm text-gray-500">{solution.confidence}% confidence</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{solution.explanation}</p>
                <pre className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg text-xs overflow-x-auto font-mono">
                  {solution.correctedCode}
                </pre>
              </div>
            ))}

            {result.recommendations.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Recommendations</h3>
                <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 space-y-1">
                  {result.recommendations.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
