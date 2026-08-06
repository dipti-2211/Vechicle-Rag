import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Plus,
  UploadCloud,
  Trash2,
  Search,
  CheckCircle,
  AlertCircle,
  Loader2,
  Clock,
  RefreshCw,
  X,
  Eye,
  MessageSquare,
  Cpu,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { useDocumentPolling } from '../hooks/useDocumentPolling';
import { LoadingSpinner } from '../components/ui/Loading';

// ── Helpers ────────────────────────────────────────────────────────

function formatSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

const STATUS_CONFIG = {
  ready:      { label: 'Ready',      color: 'text-accent-600 dark:text-accent-400',   bg: 'bg-accent-50 dark:bg-accent-500/10',   icon: CheckCircle, spin: false },
  processing: { label: 'Processing', color: 'text-primary-600 dark:text-primary-400', bg: 'bg-primary-50 dark:bg-primary-500/10', icon: Loader2,     spin: true  },
  error:      { label: 'Error',      color: 'text-danger-600 dark:text-danger-400',   bg: 'bg-danger-50 dark:bg-danger-500/10',   icon: AlertCircle, spin: false },
  default:    { label: 'Unknown',    color: 'text-surface-500',                        bg: 'bg-surface-100 dark:bg-surface-800',   icon: Clock,       spin: false },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.default;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
      <Icon className={`w-3.5 h-3.5 ${cfg.spin ? 'animate-spin' : ''}`} />
      {cfg.label}
    </span>
  );
}

// Status filter tabs
const TABS = [
  { key: 'all',        label: 'All' },
  { key: 'ready',      label: 'Ready' },
  { key: 'processing', label: 'Processing' },
  { key: 'error',      label: 'Error' },
];

// ── Main Component ─────────────────────────────────────────────────

export default function Documents() {
  const navigate = useNavigate();
  const { documents, loading, error, refetch } = useDocumentPolling();

  const [search, setSearch]               = useState('');
  const [activeTab, setActiveTab]          = useState('all');
  const [confirmDelete, setConfirmDelete]  = useState(null);
  const [previewDoc, setPreviewDoc]        = useState(null);  // { doc, data, loading }

  const openPreview = async (doc) => {
    setPreviewDoc({ doc, data: null, loading: true });
    try {
      const res = await api.get(`/api/documents/${doc.id}/preview`);
      setPreviewDoc({ doc, data: res.data, loading: false });
    } catch {
      setPreviewDoc({ doc, data: null, loading: false, error: true });
    }
  };

  // ── Derived lists ─────────────────────────────────────────────────
  const filtered = documents.filter(doc => {
    const matchesTab    = activeTab === 'all' || doc.status === activeTab;
    const matchesSearch = doc.original_filename.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const tabCounts = {
    all:        documents.length,
    ready:      documents.filter(d => d.status === 'ready').length,
    processing: documents.filter(d => d.status === 'processing').length,
    error:      documents.filter(d => d.status === 'error').length,
  };

  // Show vehicle column only when at least one doc has metadata
  const hasVehicleMeta = documents.some(d => d.vehicle_name || d.manufacturer);

  // ── Actions ───────────────────────────────────────────────────────
  const deleteDocument = async (id) => {
    try {
      await api.delete(`/api/documents/${id}`);
      toast.success('Document deleted.');
      setConfirmDelete(null);
      refetch();
    } catch {
      toast.error('Failed to delete document.');
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-surface-100">Documents</h1>
          <p className="text-surface-500 mt-1">
            {documents.length > 0
              ? `${documents.length} document${documents.length !== 1 ? 's' : ''} · ${tabCounts.ready} ready · ${tabCounts.processing > 0 ? `${tabCounts.processing} processing` : 'none processing'}`
              : 'Manage your uploaded vehicle manuals and logs.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refetch}
            disabled={loading}
            className="p-2 rounded-lg text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors disabled:opacity-40"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => navigate('/upload')}
            className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-lg font-medium transition-all shadow-sm shadow-primary-500/20"
          >
            <Plus className="w-4 h-4" />
            Upload New
          </button>
        </div>
      </header>

      {/* Search + Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by filename..."
            className="w-full pl-9 pr-9 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100 placeholder-surface-400 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status tabs */}
        <div className="flex gap-1 p-1 bg-surface-100 dark:bg-surface-800 rounded-lg flex-shrink-0">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeTab === tab.key
                  ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 shadow-sm'
                  : 'text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'
              }`}
            >
              {tab.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                activeTab === tab.key
                  ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
                  : 'bg-surface-200 dark:bg-surface-700 text-surface-500'
              }`}>
                {tabCounts[tab.key]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading && documents.length === 0 ? (
        <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm p-16 flex justify-center">
          <LoadingSpinner size={32} />
        </div>
      ) : error ? (
        <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm p-12 text-center">
          <AlertCircle className="w-10 h-10 text-danger-500 mx-auto mb-3" />
          <p className="text-surface-600 dark:text-surface-400 mb-4">{error}</p>
          <button
            onClick={refetch}
            className="px-4 py-2 bg-surface-100 dark:bg-surface-800 rounded-lg text-surface-900 dark:text-surface-100 font-medium hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : documents.length === 0 ? (
        <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm p-16 flex flex-col items-center justify-center min-h-[400px]">
          <div className="w-16 h-16 bg-surface-100 dark:bg-surface-800 rounded-full flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-surface-400" />
          </div>
          <h3 className="text-lg font-medium text-surface-900 dark:text-surface-100">No documents yet</h3>
          <p className="text-surface-500 mt-1 mb-6 text-center max-w-sm text-sm">
            Upload your first vehicle document to let the AI assistant start helping you.
          </p>
          <button
            onClick={() => navigate('/upload')}
            className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
          >
            <UploadCloud className="w-4 h-4" />
            Upload Document
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm p-12 text-center">
          <Search className="w-10 h-10 text-surface-300 dark:text-surface-600 mx-auto mb-3" />
          <p className="text-surface-500 text-sm">No documents match your search.</p>
          <button onClick={() => { setSearch(''); setActiveTab('all'); }} className="mt-3 text-sm text-primary-600 dark:text-primary-400 hover:underline">
            Clear filters
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-50 dark:bg-surface-800/50 text-surface-500 dark:text-surface-400 uppercase tracking-wider text-xs font-semibold border-b border-surface-200 dark:border-surface-800">
                <tr>
                  <th className="px-6 py-3.5">Document</th>
                  <th className="px-6 py-3.5">Status</th>
                  {hasVehicleMeta && <th className="px-6 py-3.5 hidden md:table-cell">Vehicle</th>}
                  <th className="px-6 py-3.5 hidden sm:table-cell">Size</th>
                  <th className="px-6 py-3.5 hidden md:table-cell">Chunks</th>
                  <th className="px-6 py-3.5 hidden lg:table-cell">Uploaded</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                {filtered.map(doc => (
                  <tr key={doc.id} className="hover:bg-surface-50/50 dark:hover:bg-surface-800/20 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                        </div>
                        <div className="min-w-0">
                          <button
                            onClick={() => openPreview(doc)}
                            className="font-medium text-surface-900 dark:text-surface-100 truncate max-w-[180px] sm:max-w-[260px] hover:text-primary-600 dark:hover:text-primary-400 text-left block transition-colors"
                            title="Click to preview content"
                          >
                            {doc.original_filename}
                          </button>
                          <p className="text-xs text-surface-400 uppercase mt-0.5">{doc.file_type}</p>
                          {doc.status === 'error' && doc.error_message && (
                            <p className="text-xs text-danger-500 mt-0.5 truncate max-w-[200px]" title={doc.error_message}>
                              {doc.error_message}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <StatusBadge status={doc.status} />
                    </td>

                    {hasVehicleMeta && (
                      <td className="px-6 py-4 hidden md:table-cell">
                        {doc.vehicle_name || doc.manufacturer ? (
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate max-w-[150px]">
                              {doc.vehicle_name ?? doc.manufacturer}
                            </p>
                            {doc.vehicle_name && doc.manufacturer && (
                              <p className="text-xs text-surface-400 truncate max-w-[150px]">{doc.manufacturer}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-surface-300 dark:text-surface-600 text-sm">—</span>
                        )}
                      </td>
                    )}

                    <td className="px-6 py-4 hidden sm:table-cell text-surface-500 dark:text-surface-400 text-sm">
                      {formatSize(doc.file_size)}
                    </td>

                    <td className="px-6 py-4 hidden md:table-cell text-surface-500 dark:text-surface-400 text-sm">
                      {doc.chunk_count > 0 ? doc.chunk_count : <span className="text-surface-300 dark:text-surface-600">—</span>}
                    </td>

                    <td className="px-6 py-4 hidden lg:table-cell text-surface-500 dark:text-surface-400 text-sm">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </td>

                    <td className="px-6 py-4 text-right">
                      {confirmDelete === doc.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs text-surface-500 dark:text-surface-400">Delete?</span>
                          <button
                            onClick={() => deleteDocument(doc.id)}
                            className="px-2.5 py-1 rounded-md bg-danger-500 hover:bg-danger-600 text-white text-xs font-medium transition-colors"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="px-2.5 py-1 rounded-md bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-700 dark:text-surface-300 text-xs font-medium transition-colors"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(doc.id)}
                          className="p-2 rounded-lg text-surface-300 dark:text-surface-600 hover:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/10 transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete document"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-surface-100 dark:border-surface-800 text-xs text-surface-400 flex items-center justify-between">
            <span>
              {filtered.length} of {documents.length} document{documents.length !== 1 ? 's' : ''}
              {tabCounts.processing > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 text-primary-500">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Auto-updating…
                </span>
              )}
            </span>
            {search && <span>Searching: "{search}"</span>}
          </div>
        </div>
        </div>
      )}
    </div>

    {/* ── Document Preview Modal ──────────────────────────────────── */}
    {previewDoc && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={() => setPreviewDoc(null)}
      >
        <div
          className="bg-white dark:bg-surface-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-surface-200 dark:border-surface-700"
          onClick={e => e.stopPropagation()}
        >
          {/* Modal header */}
          <div className="flex items-start justify-between px-6 py-4 border-b border-surface-200 dark:border-surface-800 flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold text-surface-900 dark:text-surface-100 truncate text-base">
                  {previewDoc.doc.original_filename}
                </h2>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs text-surface-400 uppercase">{previewDoc.doc.file_type}</span>
                  {previewDoc.doc.vehicle_name && (
                    <span className="text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded-full">
                      {previewDoc.doc.vehicle_name}
                    </span>
                  )}
                  {previewDoc.doc.manufacturer && !previewDoc.doc.vehicle_name && (
                    <span className="text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded-full">
                      {previewDoc.doc.manufacturer}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => setPreviewDoc(null)}
              className="p-1.5 rounded-lg text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors flex-shrink-0 ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal body — preview content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {previewDoc.loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                <span className="ml-2 text-surface-400 text-sm">Loading preview…</span>
              </div>
            ) : previewDoc.error ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="w-8 h-8 text-danger-400 mb-2" />
                <p className="text-surface-500 text-sm">Failed to load preview.</p>
              </div>
            ) : !previewDoc.data ? null : (
              <>
                {/* Stats row */}
                <div className="flex items-center gap-4 mb-4 text-xs text-surface-400">
                  {previewDoc.data.total_chars != null && (
                    <span>{previewDoc.data.total_chars.toLocaleString()} characters total</span>
                  )}
                  {previewDoc.doc.chunk_count > 0 && (
                    <span>{previewDoc.doc.chunk_count} chunks indexed</span>
                  )}
                </div>

                {/* Content preview */}
                <div className="bg-surface-50 dark:bg-surface-800 rounded-xl p-4 font-mono text-sm text-surface-700 dark:text-surface-300 whitespace-pre-wrap leading-relaxed border border-surface-200 dark:border-surface-700">
                  {previewDoc.data.preview}
                  {previewDoc.data.preview_truncated && (
                    <span className="text-surface-400 not-italic font-sans block mt-2">
                      … (content truncated — showing first 800 characters)
                    </span>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Modal footer */}
          <div className="px-6 py-4 border-t border-surface-200 dark:border-surface-800 flex items-center justify-between flex-shrink-0">
            <p className="text-xs text-surface-400">
              <Eye className="w-3.5 h-3.5 inline mr-1" />
              Content preview
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 text-sm rounded-lg border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
              >
                Close
              </button>
              {previewDoc.doc.status === 'ready' && (
                <button
                  onClick={() => {
                    setPreviewDoc(null);
                    navigate('/chat');
                  }}
                  className="px-4 py-2 text-sm rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium transition-colors flex items-center gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Ask about this doc
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )}
  );
}
