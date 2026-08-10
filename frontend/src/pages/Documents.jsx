import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, UploadCloud, Trash2, Search, CheckCircle,
  AlertCircle, Loader2, Clock, RefreshCw, X, Eye,
  MessageSquare, Database, FileSpreadsheet,
  FileType, Files,
} from 'lucide-react';

import toast from 'react-hot-toast';
import api from '../api/axios';
import { useDocumentPolling } from '../hooks/useDocumentPolling';
import { LoadingSpinner } from '../components/ui/Loading';

// ── Helpers ─────────────────────────────────────────────────────────

function formatSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatDate(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function FileTypeIcon({ type }) {
  const icons = {
    pdf:  { icon: FileType,        color: 'text-red-400',   bg: 'bg-red-500/10' },
    xlsx: { icon: FileSpreadsheet, color: 'text-green-400', bg: 'bg-green-500/10' },
    csv:  { icon: Database,        color: 'text-blue-400',  bg: 'bg-blue-500/10' },
    docx: { icon: Files,           color: 'text-sky-400',   bg: 'bg-sky-500/10' },
    txt:  { icon: FileText,        color: 'text-purple-400', bg: 'bg-purple-500/10' },
  };
  const c = icons[type] ?? { icon: FileText, color: 'text-surface-400', bg: 'bg-surface-500/10' };
  const Icon = c.icon;
  return (
    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${c.bg}`}>
      <Icon className={`w-4.5 h-4.5 ${c.color}`} />
    </div>
  );
}

function StatusBadge({ status }) {
  const c = {
    ready:      { cls: 'badge-ready',      icon: CheckCircle, label: 'Ready',      spin: false },
    processing: { cls: 'badge-processing', icon: Loader2,     label: 'Processing', spin: true  },
    error:      { cls: 'badge-error',      icon: AlertCircle, label: 'Error',      spin: false },
  }[status] ?? { cls: 'badge-processing', icon: Clock, label: status, spin: false };
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${c.cls}`}>
      <Icon className={`w-3 h-3 ${c.spin ? 'animate-spin' : ''}`} />
      {c.label}
    </span>
  );
}

const TABS = [
  { key: 'all',        label: 'All' },
  { key: 'ready',      label: 'Ready' },
  { key: 'processing', label: 'Processing' },
  { key: 'error',      label: 'Errors' },
];

// ── Main Component ───────────────────────────────────────────────────

export default function Documents() {
  const navigate = useNavigate();
  const { documents, loading, error, refetch } = useDocumentPolling();

  const [search, setSearch]              = useState('');
  const [activeTab, setActiveTab]        = useState('all');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [previewDoc, setPreviewDoc]      = useState(null);

  const openPreview = async (doc) => {
    setPreviewDoc({ doc, data: null, loading: true });
    try {
      const res = await api.get(`/api/documents/${doc.id}/preview`);
      setPreviewDoc({ doc, data: res.data, loading: false });
    } catch {
      setPreviewDoc({ doc, data: null, loading: false, error: true });
    }
  };

  // ── Derived lists ───────────────────────────────────────────────────
  const filtered = (documents ?? []).filter(d => {
    const matchTab    = activeTab === 'all' || d.status === activeTab;
    const matchSearch = !search || d.original_filename.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  const counts = (documents ?? []).reduce((acc, d) => {
    acc[d.status] = (acc[d.status] || 0) + 1;
    return acc;
  }, {});

  // ── Delete ──────────────────────────────────────────────────────────
  const handleDelete = async (doc) => {
    try {
      await api.delete(`/api/documents/${doc.id}`);
      toast.success(`"${doc.original_filename}" deleted.`);
      refetch();
    } catch {
      toast.error('Failed to delete document.');
    } finally {
      setConfirmDelete(null);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <LoadingSpinner size={36} />
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Page Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-surface-900 dark:text-white">Documents</h1>
          <p className="text-surface-500 dark:text-surface-400 mt-1 text-sm">
            {(documents ?? []).length} document{(documents ?? []).length !== 1 ? 's' : ''} in the knowledge base
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={refetch}
            className="p-2.5 glass rounded-xl text-surface-500 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white transition-all"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate('/upload')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl btn-gradient text-sm font-semibold shadow-lg shadow-primary-500/25"
          >
            <UploadCloud className="w-4 h-4" />
            Upload
          </button>
        </div>
      </div>

      {/* ── Filter bar ───────────────────────────────────────────────── */}
      <div className="glass rounded-2xl p-4 flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by filename…"
            className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-surface-100/60 dark:bg-white/5 border border-surface-200/60 dark:border-white/8 text-sm text-surface-900 dark:text-surface-100 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Status tabs */}
        <div className="flex items-center gap-1 bg-surface-100/60 dark:bg-white/5 rounded-xl p-1">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === t.key
                  ? 'bg-primary-600 text-white shadow'
                  : 'text-surface-500 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-200'
              }`}
            >
              {t.label}
              {t.key !== 'all' && counts[t.key] > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === t.key ? 'bg-white/20' : 'bg-surface-200/80 dark:bg-white/10'
                }`}>
                  {counts[t.key]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Error state ───────────────────────────────────────────────── */}
      {error && (
        <div className="glass rounded-2xl p-5 border border-danger-500/20 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-danger-400" />
          <p className="text-sm text-surface-700 dark:text-surface-300">Failed to load documents. <button onClick={refetch} className="text-primary-400 hover:text-primary-300 underline">Retry</button></p>
        </div>
      )}

      {/* ── Document Grid / Empty ─────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="glass rounded-2xl flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="w-16 h-16 rounded-2xl glass flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-surface-400" />
          </div>
          <h3 className="text-lg font-semibold text-surface-800 dark:text-surface-200 mb-2">
            {search ? 'No matching documents' : 'No documents yet'}
          </h3>
          <p className="text-sm text-surface-400 max-w-sm">
            {search
              ? `No documents match "${search}". Try a different search term.`
              : 'Upload vehicle manuals, logs, or data files to start querying them with AI.'}
          </p>
          {!search && (
            <button
              onClick={() => navigate('/upload')}
              className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-xl btn-gradient text-sm font-semibold shadow-lg"
            >
              <UploadCloud className="w-4 h-4" />
              Upload Document
            </button>
          )}
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          {/* Table header */}
          <div className="hidden md:grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4 px-5 py-3 border-b border-surface-200/50 dark:border-white/6 text-xs font-semibold uppercase tracking-wider text-surface-400">
            <span>Type</span>
            <span>Name</span>
            <span>Chunks</span>
            <span>Status</span>
            <span>Actions</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-surface-200/40 dark:divide-white/4">
            {filtered.map(doc => (
              <div
                key={doc.id}
                className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 md:gap-4 px-5 py-4 hover:bg-surface-50/50 dark:hover:bg-white/2 transition-colors group"
              >
                <FileTypeIcon type={doc.file_type} />

                <div className="min-w-0">
                  <p className="text-sm font-semibold text-surface-800 dark:text-surface-200 truncate">
                    {doc.original_filename}
                  </p>
                  <p className="text-xs text-surface-400 mt-0.5">
                    {formatSize(doc.file_size)} · {formatDate(doc.created_at)}
                    {doc.vehicle_name && ` · ${doc.vehicle_name}`}
                  </p>
                  {doc.error_message && (
                    <p className="text-xs text-danger-400 mt-1 truncate">{doc.error_message}</p>
                  )}
                </div>

                <span className="text-sm text-surface-500 dark:text-surface-400 font-mono hidden md:block">
                  {doc.chunk_count > 0 ? doc.chunk_count.toLocaleString() : '—'}
                </span>

                <StatusBadge status={doc.status} />

                {/* Actions */}
                <div className="flex items-center gap-1.5 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  {doc.status === 'ready' && (
                    <>
                      <button
                        onClick={() => openPreview(doc)}
                        title="Preview"
                        className="p-1.5 rounded-lg text-surface-400 hover:text-primary-400 hover:bg-primary-500/10 transition-all"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => navigate('/chat')}
                        title="Chat about this document"
                        className="p-1.5 rounded-lg text-surface-400 hover:text-accent-400 hover:bg-accent-500/10 transition-all"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setConfirmDelete(doc)}
                    title="Delete"
                    className="p-1.5 rounded-lg text-surface-400 hover:text-danger-400 hover:bg-danger-500/10 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Preview Modal ──────────────────────────────────────────────── */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPreviewDoc(null)} />
          <div className="relative glass-strong rounded-3xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-surface-200/50 dark:border-white/8 flex-shrink-0">
              <div className="flex items-center gap-3">
                <FileTypeIcon type={previewDoc.doc.file_type} />
                <div>
                  <h3 className="font-semibold text-surface-900 dark:text-surface-100 text-sm">
                    {previewDoc.doc.original_filename}
                  </h3>
                  <p className="text-xs text-surface-400">
                    {previewDoc.doc.chunk_count} chunks · {formatSize(previewDoc.doc.file_size)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="p-2 rounded-xl text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-100/50 dark:hover:bg-white/5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {previewDoc.loading ? (
                <div className="flex items-center justify-center py-12">
                  <LoadingSpinner size={28} />
                </div>
              ) : previewDoc.error ? (
                <div className="flex items-center gap-2 text-danger-400 text-sm py-4">
                  <AlertCircle className="w-4 h-4" />
                  Could not load preview.
                </div>
              ) : previewDoc.data ? (
                <div className="space-y-4">
                  {previewDoc.data.vehicle_name && (
                    <div className="flex items-center gap-2">
                      <span className="badge-ready px-3 py-1.5 rounded-xl text-xs font-semibold">
                        {previewDoc.data.vehicle_name}
                        {previewDoc.data.manufacturer && ` · ${previewDoc.data.manufacturer}`}
                      </span>
                    </div>
                  )}
                  <div className="glass rounded-2xl p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-surface-400 mb-3">Content Preview</p>
                    <pre className="text-sm text-surface-700 dark:text-surface-300 whitespace-pre-wrap font-mono leading-relaxed">
                      {previewDoc.data.preview}
                      {previewDoc.data.preview_truncated && (
                        <span className="text-surface-400 italic"> … (truncated)</span>
                      )}
                    </pre>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-surface-400">
                    <span>{previewDoc.data.total_chars?.toLocaleString()} characters extracted</span>
                    <span>{previewDoc.doc.chunk_count} chunks indexed</span>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="px-6 py-4 border-t border-surface-200/50 dark:border-white/8 flex justify-end gap-3 flex-shrink-0">
              <button
                onClick={() => { setPreviewDoc(null); navigate('/chat'); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl btn-gradient text-sm font-semibold"
              >
                <MessageSquare className="w-4 h-4" />
                Ask AI about this
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ───────────────────────────────────────── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
          <div className="relative glass-strong rounded-2xl w-full max-w-md p-6 shadow-2xl animate-scale-in">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-danger-500/10 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-danger-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-surface-900 dark:text-surface-100">Delete Document</h3>
                <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
                  Are you sure you want to delete <strong className="text-surface-800 dark:text-surface-200">{confirmDelete.original_filename}</strong>?
                  This also removes all {confirmDelete.chunk_count} vector embeddings. This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-xl glass text-sm font-medium text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="px-4 py-2 rounded-xl bg-danger-500 hover:bg-danger-600 text-white text-sm font-semibold transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
