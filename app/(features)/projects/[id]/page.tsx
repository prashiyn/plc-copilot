'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

// ─── types ────────────────────────────────────────────────────────────────────

interface Project {
  id: string;
  name: string;
  description: string | null;
  plcManufacturer: string | null;
  plcModel: string | null;
  programmingLanguage: string | null;
  applicationType: string | null;
  industry: string | null;
  status: string;
  templateId: string | null;
  tags: string[];
  coverImage: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

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
  } | null;
}

interface ProjectFile {
  id: string;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  storageUrl: string | null;
  operationType: string;
  createdAt: string | null;
  metadata: Record<string, unknown>;
}

interface ProjectNote {
  id: string;
  title: string;
  body: string;
  createdAt: string | null;
  updatedAt: string | null;
}

interface ProjectChat {
  sessionId: string;
  engineerName: string | null;
  engineerSpecialty: string | null;
  status: string;
  startedAt: string | null;
  linkedAt: string | null;
  messageCount: number;
  lastMessageAt: string | null;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'programs' | 'hmi' | 'files' | 'chats' | 'notes';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'programs', label: 'Programs' },
  { id: 'hmi', label: 'HMI' },
  { id: 'files', label: 'Files' },
  { id: 'chats', label: 'Chats' },
  { id: 'notes', label: 'Notes' },
];

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'testing', label: 'Testing' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
];

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  testing: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  archived: 'bg-red-100 text-red-700',
};

function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—';
}

function fmtSize(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ─── sub-components ───────────────────────────────────────────────────────────

function OverviewTab({
  project,
  onSaved,
}: {
  project: Project;
  onSaved: (updated: Project) => void;
}) {
  const [form, setForm] = useState<Partial<Project>>({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [tagInput, setTagInput] = useState('');

  const field = <K extends keyof Project>(k: K): Project[K] =>
    (form[k] as Project[K]) ?? project[k];

  const set = (k: keyof Project, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const addTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    const current = (field('tags') as string[]) ?? [];
    if (!current.includes(t)) set('tags', [...current, t]);
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    set('tags', ((field('tags') as string[]) ?? []).filter((t) => t !== tag));
  };

  const save = async () => {
    setSaving(true);
    setSaveMsg('');
    const res = await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      onSaved(data.project);
      setForm({});
      setSaveMsg('Saved.');
      setTimeout(() => setSaveMsg(''), 2000);
    } else {
      setSaveMsg('Save failed.');
    }
  };

  const tags = (field('tags') as string[]) ?? [];
  const hasChanges = Object.keys(form).length > 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
          <input
            value={(field('name') as string) ?? ''}
            onChange={(e) => set('name', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            value={(field('status') as string) ?? 'in_progress'}
            onChange={(e) => set('status', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">PLC Manufacturer</label>
          <input
            value={(field('plcManufacturer') as string) ?? ''}
            onChange={(e) => set('plcManufacturer', e.target.value || null)}
            placeholder="e.g. Siemens, Rockwell, Schneider"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">PLC Model</label>
          <input
            value={(field('plcModel') as string) ?? ''}
            onChange={(e) => set('plcModel', e.target.value || null)}
            placeholder="e.g. S7-1200, CompactLogix"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Programming Language</label>
          <input
            value={(field('programmingLanguage') as string) ?? ''}
            onChange={(e) => set('programmingLanguage', e.target.value || null)}
            placeholder="e.g. Ladder Logic, SCL, ST"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
          <input
            value={(field('industry') as string) ?? ''}
            onChange={(e) => set('industry', e.target.value || null)}
            placeholder="e.g. Process, Manufacturing, Utilities"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Application Type</label>
          <input
            value={(field('applicationType') as string) ?? ''}
            onChange={(e) => set('applicationType', e.target.value || null)}
            placeholder="e.g. Motor Control, Process Automation"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={(field('description') as string) ?? ''}
            onChange={(e) => set('description', e.target.value || null)}
            rows={3}
            placeholder="Describe the automation job, scope, and objectives…"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
          <div className="flex gap-2 flex-wrap mb-2">
            {tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 rounded-full px-3 py-0.5 text-sm">
                {t}
                <button onClick={() => removeTag(t)} className="hover:text-blue-900">×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
              placeholder="Add tag and press Enter"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <button
              onClick={addTag}
              className="px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving || !hasChanges}
          className="px-5 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        {saveMsg && (
          <span className={`text-sm font-medium ${saveMsg === 'Saved.' ? 'text-green-700' : 'text-red-600'}`}>
            {saveMsg}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-gray-100">
        <div className="text-sm text-gray-500">
          <span className="font-medium text-gray-700">Created: </span>{fmtDate(project.createdAt)}
        </div>
        <div className="text-sm text-gray-500">
          <span className="font-medium text-gray-700">Last updated: </span>{fmtDate(project.updatedAt)}
        </div>
        {project.templateId && (
          <div className="text-sm text-gray-500">
            <span className="font-medium text-gray-700">Template: </span>{project.templateId}
          </div>
        )}
      </div>
    </div>
  );
}

function ProgramsTab({ projectId }: { projectId: string }) {
  const [programs, setPrograms] = useState<StoredProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/projects/${projectId}/programs`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setPrograms(d.programs))
      .finally(() => setLoading(false));
  }, [projectId]);

  const redownload = async (program: StoredProgram) => {
    const params = (program.generationParameters as { downloadParams?: unknown })?.downloadParams;
    if (!params) return;
    setDownloadingId(program.id);
    try {
      const res = await fetch('/api/download-program', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = program.fileName || `program.${program.programFormat || 'bin'}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) return <p className="text-gray-500">Loading programs…</p>;
  if (programs.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="mb-3">No programs yet.</p>
        <Link href="/generator" className="text-blue-600 hover:text-blue-700 font-medium">
          Generate a program →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {programs.map((p) => (
        <div key={p.id} className="border border-gray-200 rounded-lg p-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-medium text-gray-900 truncate">{p.fileName ?? 'Untitled'}</p>
            <p className="text-sm text-gray-500 mt-0.5">
              {[
                p.programFormat?.toUpperCase(),
                p.generationParameters?.manufacturer,
                p.generationParameters?.pattern,
              ].filter(Boolean).join(' · ')}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{fmtDate(p.createdAt)}</p>
          </div>
          <button
            onClick={() => redownload(p)}
            disabled={downloadingId === p.id || !(p.generationParameters as Record<string, unknown>)?.downloadParams}
            className="shrink-0 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors disabled:opacity-50"
          >
            {downloadingId === p.id ? 'Downloading…' : 'Download'}
          </button>
        </div>
      ))}
    </div>
  );
}

function HmiTab({ projectId }: { projectId: string }) {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/projects/${projectId}/files?type=hmi_generate`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setFiles(d.files))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) return <p className="text-gray-500">Loading HMI files…</p>;
  if (files.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="mb-3">No HMI scripts yet.</p>
        <Link href="/hmi-generator" className="text-blue-600 hover:text-blue-700 font-medium">
          Generate HMI →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {files.map((f) => (
        <div key={f.id} className="border border-gray-200 rounded-lg p-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-medium text-gray-900 truncate">{f.fileName ?? 'HMI Script'}</p>
            <p className="text-sm text-gray-500">{fmtSize(f.fileSize)} · {fmtDate(f.createdAt)}</p>
          </div>
          {f.storageUrl && (
            <a
              href={f.storageUrl}
              download
              className="shrink-0 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
            >
              Download
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

function FilesTab({ projectId }: { projectId: string }) {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/projects/${projectId}/files?type=user_upload`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setFiles(d.files ?? []))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const fileIcon = (mimeType: string | null) => {
    if (!mimeType) return '📄';
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType === 'application/pdf') return '📑';
    if (mimeType.includes('zip')) return '🗜️';
    if (mimeType.includes('csv') || mimeType.includes('spreadsheet')) return '📊';
    return '📄';
  };

  if (loading) return <p className="text-gray-500">Loading files…</p>;

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">
        File uploads will be available once Phase C (storage) is complete.
        Use the <Link href="/hmi-generator" className="text-blue-600 hover:underline">HMI generator</Link> to
        generate and save HMI artefacts to this project.
      </p>
      {files.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl text-gray-400">
          <p className="text-4xl mb-3">📁</p>
          <p>No files attached to this project yet.</p>
          <p className="text-sm mt-1">File upload coming in Phase C.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {files.map((f) => (
            <div key={f.id} className="border border-gray-200 rounded-lg p-4 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-2xl">{fileIcon(f.mimeType)}</span>
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{f.fileName ?? 'File'}</p>
                  <p className="text-sm text-gray-500">{fmtSize(f.fileSize)} · {fmtDate(f.createdAt)}</p>
                </div>
              </div>
              {f.storageUrl && (
                <a
                  href={f.storageUrl}
                  download
                  className="shrink-0 px-3 py-1.5 bg-gray-50 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
                >
                  Download
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChatsTab({ projectId }: { projectId: string }) {
  const [chats, setChats] = useState<ProjectChat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/projects/${projectId}/chats`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setChats(d.chats))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) return <p className="text-gray-500">Loading chats…</p>;
  if (chats.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="mb-3">No chat sessions linked to this project yet.</p>
        <p className="text-sm">Chat linkage is delivered in Phase D.{' '}
          <Link href="/ai-copilot" className="text-blue-600 hover:text-blue-700">
            Start a chat →
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {chats.map((c) => (
        <div key={c.sessionId} className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">
                {c.engineerName ?? 'AI Co-Pilot'}
                {c.engineerSpecialty && (
                  <span className="text-gray-500 font-normal text-sm"> · {c.engineerSpecialty}</span>
                )}
              </p>
              <p className="text-sm text-gray-500 mt-0.5">
                Started {fmtDate(c.startedAt)} · {c.messageCount} message{c.messageCount !== 1 ? 's' : ''}
              </p>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
              {c.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function NotesTab({ projectId }: { projectId: string }) {
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    fetch(`/api/projects/${projectId}/notes`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setNotes(d.notes))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!newTitle.trim() && !newBody.trim()) return;
    setCreating(true);
    setError('');
    const res = await fetch(`/api/projects/${projectId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle || 'Note', body: newBody }),
    });
    setCreating(false);
    if (res.ok) {
      setNewTitle('');
      setNewBody('');
      load();
    } else {
      setError('Could not create note.');
    }
  };

  const startEdit = (note: ProjectNote) => {
    setEditingId(note.id);
    setEditTitle(note.title);
    setEditBody(note.body);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    const res = await fetch(`/api/projects/${projectId}/notes/${editingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editTitle, body: editBody }),
    });
    setSaving(false);
    if (res.ok) {
      setEditingId(null);
      load();
    }
  };

  const deleteNote = async (noteId: string) => {
    await fetch(`/api/projects/${projectId}/notes/${noteId}`, { method: 'DELETE' });
    load();
  };

  if (loading) return <p className="text-gray-500">Loading notes…</p>;

  return (
    <div className="space-y-4">
      {/* New note form */}
      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <p className="text-sm font-semibold text-gray-700 mb-2">New Note</p>
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Title (optional)"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
        <textarea
          value={newBody}
          onChange={(e) => setNewBody(e.target.value)}
          placeholder="Write your note here… (markdown supported)"
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
        />
        {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
        <button
          onClick={create}
          disabled={creating || (!newTitle.trim() && !newBody.trim())}
          className="mt-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {creating ? 'Adding…' : 'Add Note'}
        </button>
      </div>

      {notes.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-6">No notes yet. Add one above.</p>
      ) : (
        notes.map((note) =>
          editingId === note.id ? (
            <div key={note.id} className="border-2 border-green-300 rounded-lg p-4">
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2 text-sm font-semibold focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={5}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="px-4 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div key={note.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <p className="font-semibold text-gray-900">{note.title}</p>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => startEdit(note)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteNote(note.id)}
                    className="text-sm text-red-600 hover:text-red-700 font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{note.body || <em className="text-gray-400">Empty note</em>}</pre>
              <p className="text-xs text-gray-400 mt-2">{fmtDate(note.updatedAt)}</p>
            </div>
          ),
        )
      )}
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function ProjectWorkspacePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>(
    (searchParams.get('tab') as Tab | null) ?? 'overview',
  );

  useEffect(() => {
    if (!params?.id) return;
    fetch(`/api/projects/${params.id}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.ok ? r.json() : null;
      })
      .then((d) => d && setProject(d.project))
      .finally(() => setLoading(false));
  }, [params?.id]);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    router.replace(url.pathname + url.search, { scroll: false });
  };

  if (loading) {
    return (
      <div className="py-8 px-4 max-w-7xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-gray-200 rounded" />
          <div className="h-4 w-32 bg-gray-100 rounded" />
          <div className="h-64 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (notFound || !project) {
    return (
      <div className="py-8 px-4 max-w-7xl mx-auto text-center">
        <p className="text-xl font-semibold text-gray-700 mb-2">Project not found</p>
        <p className="text-gray-500 mb-4">This project does not exist or you do not have access to it.</p>
        <Link href="/projects/active" className="text-blue-600 hover:text-blue-700 font-medium">
          ← Back to projects
        </Link>
      </div>
    );
  }

  return (
    <div className="py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/projects/active" className="hover:text-gray-700">Projects</Link>
            <span>›</span>
            <span className="text-gray-900 font-medium truncate">{project.name}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className={`px-3 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[project.status] ?? 'bg-gray-100 text-gray-700'}`}>
                  {STATUS_OPTIONS.find((o) => o.value === project.status)?.label ?? project.status}
                </span>
                {project.plcManufacturer && (
                  <span className="text-sm text-gray-500">{project.plcManufacturer}{project.plcModel ? ` ${project.plcModel}` : ''}</span>
                )}
                {project.industry && (
                  <span className="text-sm text-gray-500">{project.industry}</span>
                )}
                {(project.tags ?? []).map((t) => (
                  <span key={t} className="bg-blue-50 text-blue-600 rounded-full px-2 py-0.5 text-xs">{t}</span>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Link
                href="/generator"
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors"
              >
                Generate Program
              </Link>
              <Link
                href="/hmi-generator"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                Generate HMI
              </Link>
            </div>
          </div>
          {project.description && (
            <p className="text-gray-600 mt-2 text-sm max-w-2xl">{project.description}</p>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="flex gap-0 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-green-600 text-green-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab panels */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          {activeTab === 'overview' && (
            <OverviewTab project={project} onSaved={setProject} />
          )}
          {activeTab === 'programs' && <ProgramsTab projectId={project.id} />}
          {activeTab === 'hmi' && <HmiTab projectId={project.id} />}
          {activeTab === 'files' && <FilesTab projectId={project.id} />}
          {activeTab === 'chats' && <ChatsTab projectId={project.id} />}
          {activeTab === 'notes' && <NotesTab projectId={project.id} />}
        </div>
      </div>
    </div>
  );
}
