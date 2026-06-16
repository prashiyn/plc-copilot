'use client';

import { useState } from 'react';
import type { PlcProgram } from '@/lib/plc-ir/types';

type SketchPlatform = 'schneider' | 'rockwell' | 'siemens' | 'mitsubishi';

interface SketchGenerateResponse {
  success: boolean;
  fileName: string;
  mimeType: string;
  contentBase64: string;
  metadata?: Record<string, unknown>;
  ir?: PlcProgram;
}

const PLATFORMS: { id: SketchPlatform; label: string; defaultController: string }[] = [
  { id: 'schneider', label: 'Schneider Electric', defaultController: 'TM221CE24R' },
  { id: 'rockwell', label: 'Rockwell Automation', defaultController: '1769-L33ER' },
  { id: 'siemens', label: 'Siemens', defaultController: 'S7-1200' },
  { id: 'mitsubishi', label: 'Mitsubishi', defaultController: 'FX5U' },
];

export default function SketchGeneratorPage() {
  const [image, setImage] = useState<File | null>(null);
  const [platform, setPlatform] = useState<SketchPlatform>('schneider');
  const [projectName, setProjectName] = useState('SketchProject');
  const [controller, setController] = useState('TM221CE24R');
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<SketchGenerateResponse | null>(null);

  const onPlatformChange = (next: SketchPlatform) => {
    setPlatform(next);
    const cfg = PLATFORMS.find((p) => p.id === next);
    if (cfg) setController(cfg.defaultController);
  };

  const handleGenerate = async () => {
    if (!image) {
      setError('Upload a ladder sketch image first.');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('image', image);
      formData.append('platform', platform);
      formData.append('projectName', projectName);
      formData.append('controller', controller);
      formData.append('include_metadata', includeMetadata ? 'true' : 'false');

      const response = await fetch('/api/generate-from-sketch', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Sketch generation failed');
      }

      if (includeMetadata) {
        const data = (await response.json()) as SketchGenerateResponse;
        setResult(data);
      } else {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${projectName}.zip`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  const downloadResult = () => {
    if (!result?.contentBase64) return;
    const bytes = Uint8Array.from(atob(result.contentBase64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: result.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sketch to PLC</h1>
          <p className="text-gray-600 mt-2">
            Upload a hand-drawn ladder sketch and generate an importable PLC project via the
            automation service.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sketch image</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImage(e.target.files?.[0] ?? null)}
              className="w-full text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
            <select
              value={platform}
              onChange={(e) => onPlatformChange(e.target.value as SketchPlatform)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              {PLATFORMS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project name</label>
              <input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Controller</label>
              <input
                value={controller}
                onChange={(e) => setController(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={includeMetadata}
              onChange={(e) => setIncludeMetadata(e.target.checked)}
              className="rounded border-gray-300"
            />
            Return IR metadata (JSON response)
          </label>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading || !image}
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Generating…' : 'Generate from sketch'}
          </button>
        </div>

        {result && (
          <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Result</h2>
              <button
                type="button"
                onClick={downloadResult}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Download {result.fileName}
              </button>
            </div>
            {result.metadata && (
              <pre className="text-xs bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto max-h-64">
                {JSON.stringify(result.metadata, null, 2)}
              </pre>
            )}
            {result.ir && (
              <details>
                <summary className="cursor-pointer text-blue-600 font-medium">IR program</summary>
                <pre className="mt-2 text-xs bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto max-h-96">
                  {JSON.stringify(result.ir, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
