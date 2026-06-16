'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface CatalogEntry {
  id: string;
  manufacturer: string;
  series: string;
  model: string;
  ioDescription: string;
  memoryKb: number | null;
  scanTime: string | null;
  connectivity: string;
  priceMin: number;
  priceMax: number;
  priceMid: number;
}

export default function CompareSolutionsPage() {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    fetch('/api/plc-catalog')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load catalog');
        return r.json();
      })
      .then((data) => {
        setCatalog(data.entries ?? []);
        const defaults: string[] = data.compareDefaultIds ?? [];
        setSelectedIds(defaults.slice(0, 2));
      })
      .catch(() => setLoadError('Could not load PLC catalog. Try again later.'))
      .finally(() => setLoading(false));
  }, []);

  const togglePLC = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((plcId) => plcId !== id));
    } else if (selectedIds.length < 3) {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const filtered = catalog.filter((plc) => {
    if (!filter.trim()) return true;
    const q = filter.toLowerCase();
    return (
      plc.manufacturer.toLowerCase().includes(q) ||
      plc.model.toLowerCase().includes(q) ||
      plc.series.toLowerCase().includes(q)
    );
  });

  const selected = catalog.filter((plc) => selectedIds.includes(plc.id));

  return (
    <div className="py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Compare PLC Solutions</h1>
            <p className="text-gray-600">
              Side-by-side comparison from the live PLC catalog used by recommend/rectify.
            </p>
          </div>
          <Link
            href="/solutions/recommend"
            className="text-blue-600 font-medium hover:underline whitespace-nowrap"
          >
            Get AI solution recommendation →
          </Link>
        </div>

        {loading ? (
          <p className="text-gray-500">Loading catalog…</p>
        ) : loadError ? (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4">{loadError}</div>
        ) : (
          <>
            <div className="mb-8 bg-white rounded-lg shadow-md p-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  Select PLCs ({selectedIds.length}/3)
                </h2>
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filter by manufacturer or model…"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-h-96 overflow-y-auto">
                {filtered.map((plc) => (
                  <button
                    key={plc.id}
                    type="button"
                    onClick={() => togglePLC(plc.id)}
                    className={`text-left p-4 rounded-lg border-2 transition-all ${
                      selectedIds.includes(plc.id)
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="font-semibold text-gray-900">{plc.model}</div>
                    <p className="text-sm text-gray-600">{plc.manufacturer}</p>
                    <p className="text-xs text-gray-500 mt-1">{plc.series}</p>
                    {plc.priceMid > 0 && (
                      <p className="text-lg font-bold text-blue-600 mt-2">
                        ${plc.priceMin.toLocaleString()}–${plc.priceMax.toLocaleString()}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {selected.length > 0 ? (
              <div className="bg-white rounded-lg shadow-md overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="text-left p-4 font-semibold text-gray-700 bg-gray-50">Feature</th>
                      {selected.map((plc) => (
                        <th key={plc.id} className="text-left p-4 font-semibold text-gray-900 min-w-[200px]">
                          <div>{plc.model}</div>
                          <div className="text-sm font-normal text-gray-600">{plc.manufacturer}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-100">
                      <td className="p-4 font-medium text-gray-700">Series</td>
                      {selected.map((plc) => (
                        <td key={plc.id} className="p-4 text-gray-900">{plc.series}</td>
                      ))}
                    </tr>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <td className="p-4 font-medium text-gray-700">I/O</td>
                      {selected.map((plc) => (
                        <td key={plc.id} className="p-4 text-gray-900">{plc.ioDescription}</td>
                      ))}
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="p-4 font-medium text-gray-700">Memory</td>
                      {selected.map((plc) => (
                        <td key={plc.id} className="p-4 text-gray-900">
                          {plc.memoryKb != null ? `${plc.memoryKb} KB` : '—'}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <td className="p-4 font-medium text-gray-700">Scan time</td>
                      {selected.map((plc) => (
                        <td key={plc.id} className="p-4 text-gray-900">{plc.scanTime ?? '—'}</td>
                      ))}
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="p-4 font-medium text-gray-700">Connectivity</td>
                      {selected.map((plc) => (
                        <td key={plc.id} className="p-4 text-gray-900">{plc.connectivity}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-4 font-medium text-gray-700">Price range (USD)</td>
                      {selected.map((plc) => (
                        <td key={plc.id} className="p-4 text-gray-900 font-semibold">
                          {plc.priceMid > 0
                            ? `$${plc.priceMin.toLocaleString()} – $${plc.priceMax.toLocaleString()}`
                            : '—'}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-12 text-center">
                <p className="text-gray-600 text-lg">Select PLCs above to start comparing</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
