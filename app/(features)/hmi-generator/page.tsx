'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { extractTagsFromProgramIr, type HmiTag } from '@/lib/hmi-ir-tags';

interface HmiGenerateResponse {
  scriptFileName: string;
  scriptContent: string;
  tagsCsv: string;
  tags: HmiTag[];
  importGuide: string;
  zipFileName: string;
  contentBase64: string;
}

interface SavedProgram {
  id: string;
  fileName: string | null;
  generationParameters: { ir?: unknown } | null;
}

const PLATFORMS = [
  { id: 'siemens-wincc', name: 'Siemens WinCC', language: 'VBScript/C#', market: '35%' },
  { id: 'rockwell-factorytalk', name: 'Rockwell FactoryTalk View', language: 'VBA', market: '25%' },
  { id: 'schneider-vijeo', name: 'Schneider Vijeo Designer', language: 'JavaScript', market: '10%' },
  { id: 'mitsubishi-gt', name: 'Mitsubishi GT Designer', language: 'Ladder/Script', market: '15%' },
  { id: 'abb-800xa', name: 'ABB 800xA', language: 'C#/.NET', market: '8%' },
  { id: 'wonderware', name: 'Wonderware InTouch', language: 'QuickScript', market: '12%' },
  { id: 'ignition', name: 'Ignition SCADA', language: 'Python/Jython', market: '5%' },
  { id: 'codesys-visu', name: 'CODESYS Visualization', language: 'IEC 61131-3', market: '500+ brands' },
];

const SCREEN_TYPES = [
  { id: 'process-overview', name: 'Process Overview', desc: 'Main process monitoring screen' },
  { id: 'tank-level', name: 'Tank Level Control', desc: 'Tank filling and monitoring' },
  { id: 'motor-control', name: 'Motor Control Panel', desc: 'Start/stop/speed control' },
  { id: 'alarm-display', name: 'Alarm Display', desc: 'Real-time alarm management' },
  { id: 'trend-chart', name: 'Trend Chart', desc: 'Historical data visualization' },
  { id: 'recipe-management', name: 'Recipe Management', desc: 'Production recipe selection' },
  { id: 'conveyor-system', name: 'Conveyor System', desc: 'Material handling control' },
  { id: 'temperature-control', name: 'Temperature Control', desc: 'Heating/cooling control' },
  { id: 'custom', name: 'Custom Screen', desc: 'Describe your requirements' },
];

export default function HMIGenerator() {
  const { data: session } = useSession();
  const [projectName, setProjectName] = useState('');
  const [platform, setPlatform] = useState('siemens-wincc');
  const [screenType, setScreenType] = useState('process-overview');
  const [description, setDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<HmiGenerateResponse | null>(null);
  const [programs, setPrograms] = useState<SavedProgram[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [prefillTags, setPrefillTags] = useState<HmiTag[]>([]);

  useEffect(() => {
    if (!session) return;
    fetch('/api/programs')
      .then((res) => (res.ok ? res.json() : { programs: [] }))
      .then((data) => setPrograms(data.programs ?? []))
      .catch(() => setPrograms([]));
  }, [session]);

  const onProgramSelect = (programId: string) => {
    setSelectedProgramId(programId);
    if (!programId) {
      setPrefillTags([]);
      return;
    }
    const program = programs.find((p) => p.id === programId);
    setPrefillTags(extractTagsFromProgramIr(program?.generationParameters?.ir));
  };

  const generateHmi = async () => {
    setIsGenerating(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/hmi-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor: platform,
          screenType,
          description,
          projectName,
          tags: prefillTags,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'HMI generation failed');
      }

      setResult({
        scriptFileName: data.scriptFileName,
        scriptContent: data.scriptContent,
        tagsCsv: data.tagsCsv,
        tags: data.tags ?? [],
        importGuide: data.importGuide,
        zipFileName: data.zipFileName,
        contentBase64: data.contentBase64,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'HMI generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadZip = () => {
    if (!result?.contentBase64) return;
    const binary = atob(result.contentBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = result.zipFileName || 'hmi_package.zip';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const displayTags = result?.tags?.length ? result.tags : prefillTags;
  const canGenerate = Boolean(projectName.trim() && description.trim());

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-block px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold mb-4">
            HMI CODE GENERATOR
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            AI-Powered HMI Screen Generator
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Generate importable HMI scripts, tag tables, and zip packages for Siemens WinCC, Rockwell
            FactoryTalk, Schneider Vijeo, Ignition, and more.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Configuration</h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Project Name</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g., Water Treatment Plant"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">HMI/SCADA Platform</label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                >
                  {PLATFORMS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.language}) - {p.market}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Screen Type</label>
                <select
                  value={screenType}
                  onChange={(e) => setScreenType(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                >
                  {SCREEN_TYPES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} - {s.desc}
                    </option>
                  ))}
                </select>
              </div>

              {session && programs.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Link PLC Program (optional)
                  </label>
                  <select
                    value={selectedProgramId}
                    onChange={(e) => onProgramSelect(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">No linked program</option>
                    {programs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.fileName || `Program ${p.id.slice(0, 8)}`}
                      </option>
                    ))}
                  </select>
                  {prefillTags.length > 0 && (
                    <p className="text-sm text-gray-500 mt-2">
                      {prefillTags.length} tag(s) prefilled from PLC IR
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description (Natural Language)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your HMI screen requirements in plain English..."
                  rows={6}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none resize-none"
                />
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                onClick={generateHmi}
                disabled={isGenerating || !canGenerate}
                className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <span className="material-icons animate-spin">refresh</span>
                    Generating HMI Package...
                  </>
                ) : (
                  <>
                    <span className="material-icons">code</span>
                    Generate HMI Package
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="bg-gray-900 rounded-2xl shadow-lg p-8 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">Generated Output</h2>
              {result && (
                <div className="flex gap-2">
                  <button
                    onClick={() => navigator.clipboard.writeText(result.scriptContent)}
                    className="px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 text-sm flex items-center gap-1"
                  >
                    <span className="material-icons text-sm">content_copy</span>
                    Copy Script
                  </button>
                  <button
                    onClick={downloadZip}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center gap-1"
                  >
                    <span className="material-icons text-sm">download</span>
                    Download ZIP
                  </button>
                </div>
              )}
            </div>

            {result?.importGuide && (
              <div className="mb-4 rounded-lg bg-gray-800 p-4 text-sm text-gray-300 whitespace-pre-wrap">
                <p className="font-semibold text-white mb-1">Import guide</p>
                {result.importGuide}
              </div>
            )}

            <div className="bg-gray-800 rounded-lg p-4 flex-1 min-h-[320px] overflow-auto mb-4">
              {result ? (
                <pre className="text-green-400 text-sm font-mono whitespace-pre-wrap">
                  {result.scriptContent}
                </pre>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <span className="material-icons text-6xl mb-4 block">code_off</span>
                    <p>Configure settings and click Generate</p>
                  </div>
                </div>
              )}
            </div>

            {displayTags.length > 0 && (
              <div className="overflow-auto max-h-48">
                <p className="text-white font-semibold mb-2 text-sm">
                  Tags {result ? '(generated)' : '(from PLC program)'}
                </p>
                <table className="w-full text-left text-xs text-gray-300">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="py-1 pr-2">Name</th>
                      <th className="py-1 pr-2">Address</th>
                      <th className="py-1 pr-2">Type</th>
                      <th className="py-1">Comment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayTags.map((tag) => (
                      <tr key={tag.name} className="border-b border-gray-800">
                        <td className="py-1 pr-2 font-mono">{tag.name}</td>
                        <td className="py-1 pr-2 font-mono">{tag.address}</td>
                        <td className="py-1 pr-2">{tag.type}</td>
                        <td className="py-1">{tag.comment}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="mt-12 grid md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl p-6 border-2 border-blue-200">
            <span className="material-icons text-blue-600 text-4xl mb-3 block">devices</span>
            <h3 className="text-lg font-bold text-gray-900 mb-2">8+ Platforms</h3>
            <p className="text-gray-600 text-sm">Vendor-specific scripts with import guides</p>
          </div>
          <div className="bg-white rounded-xl p-6 border-2 border-green-200">
            <span className="material-icons text-green-600 text-4xl mb-3 block">archive</span>
            <h3 className="text-lg font-bold text-gray-900 mb-2">ZIP Package</h3>
            <p className="text-gray-600 text-sm">Script, tags.csv, and README in one download</p>
          </div>
          <div className="bg-white rounded-xl p-6 border-2 border-purple-200">
            <span className="material-icons text-purple-600 text-4xl mb-3 block">link</span>
            <h3 className="text-lg font-bold text-gray-900 mb-2">PLC Tag Link</h3>
            <p className="text-gray-600 text-sm">Prefill tags from saved generated programs</p>
          </div>
        </div>
      </div>
    </div>
  );
}
