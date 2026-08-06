import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  MessageSquare,
  UploadCloud,
  CheckCircle,
  Loader2,
  AlertCircle,
  ArrowRight,
  Cpu,
  Database,
} from 'lucide-react';
import api from '../api/axios';
import { useDocumentPolling } from '../hooks/useDocumentPolling';

/** Format bytes to human-readable string */
function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/** Status badge component */
function StatusBadge({ status }) {
  const config = {
    ready:      { color: 'bg-accent-500/10 text-accent-600 dark:text-accent-400',      icon: CheckCircle, label: 'Ready' },
    processing: { color: 'bg-primary-500/10 text-primary-600 dark:text-primary-400',   icon: Loader2,     label: 'Processing', spin: true },
    error:      { color: 'bg-danger-500/10 text-danger-600 dark:text-danger-400',       icon: AlertCircle, label: 'Error' },
  }[status] ?? { color: 'bg-surface-200 dark:bg-surface-700 text-surface-500', icon: FileText, label: status };

  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      <Icon className={`w-3 h-3 ${config.spin ? 'animate-spin' : ''}`} />
      {config.label}
    </span>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  // useDocumentPolling gives us live data + auto-polls while any doc is processing
  const { documents, loading: docsLoading } = useDocumentPolling();
  const [stats, setStats]   = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [statsRes, healthRes] = await Promise.all([
          api.get('/api/documents/stats'),
          api.get('/health'),
        ]);
        setStats(statsRes.data);
        setHealth(healthRes.data);
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Keep stats in sync when polling updates document list
  useEffect(() => {
    if (!documents.length && docsLoading) return;
    setStats(prev => ({
      ...prev,
      total:      documents.length,
      ready:      documents.filter(d => d.status === 'ready').length,
      processing: documents.filter(d => d.status === 'processing').length,
      error:      documents.filter(d => d.status === 'error').length,
    }));
  }, [documents, docsLoading]);

  const totalDocs   = stats?.total      ?? 0;
  const readyDocs   = stats?.ready      ?? 0;
  const processDocs = stats?.processing ?? 0;
  const recentDocs  = [...documents].slice(0, 5);

  const statCards = [
    {
      label: 'Total Documents',
      value: totalDocs,
      icon: Database,
      color: 'from-primary-500 to-primary-600',
      bg: 'bg-primary-500/10 dark:bg-primary-500/5',
    },
    {
      label: 'Ready to Query',
      value: readyDocs,
      icon: CheckCircle,
      color: 'from-accent-500 to-accent-600',
      bg: 'bg-accent-500/10 dark:bg-accent-500/5',
    },
    {
      label: 'Processing',
      value: processDocs,
      icon: Loader2,
      color: 'from-blue-500 to-blue-600',
      bg: 'bg-blue-500/10 dark:bg-blue-500/5',
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">

      {/* Header */}
      <header>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-surface-100">Dashboard</h1>
        <p className="text-surface-500 mt-1">
          {health
            ? `${health.app} v${health.version} — ${health.environment}`
            : 'Vehicle Intelligence Assistant'}
        </p>
      </header>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 p-6 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow"
            >
              <div className={`w-12 h-12 rounded-xl ${stat.bg} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-6 h-6 bg-gradient-to-br ${stat.color} bg-clip-text`}
                  style={{ color: 'transparent', backgroundImage: `linear-gradient(to bottom right, var(--tw-gradient-from), var(--tw-gradient-to))`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
                />
              </div>
              <div>
                <p className="text-2xl font-bold text-surface-900 dark:text-surface-100">
                  {loading ? (
                    <span className="inline-block h-8 w-8 rounded bg-surface-200 dark:bg-surface-700 animate-pulse" />
                  ) : stat.value}
                </p>
                <p className="text-sm text-surface-500 mt-0.5">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={() => navigate('/upload')}
          className="group flex items-center justify-between p-5 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white rounded-2xl shadow-sm shadow-primary-500/20 transition-all"
        >
          <div className="flex items-center gap-3">
            <UploadCloud className="w-6 h-6" />
            <div className="text-left">
              <p className="font-semibold">Upload Documents</p>
              <p className="text-primary-200 text-sm">Add PDFs, CSVs, or text files</p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 opacity-70 group-hover:translate-x-1 transition-transform" />
        </button>

        <button
          onClick={() => navigate('/chat')}
          className="group flex items-center justify-between p-5 bg-gradient-to-r from-accent-600 to-accent-700 hover:from-accent-700 hover:to-accent-800 text-white rounded-2xl shadow-sm shadow-accent-500/20 transition-all"
        >
          <div className="flex items-center gap-3">
            <MessageSquare className="w-6 h-6" />
            <div className="text-left">
              <p className="font-semibold">Ask the Assistant</p>
              <p className="text-accent-200 text-sm">
                {readyDocs > 0 ? `${readyDocs} document${readyDocs > 1 ? 's' : ''} ready to query` : 'Upload documents to get started'}
              </p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 opacity-70 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      {/* Recent Documents */}
      <section className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-200 dark:border-surface-800 flex items-center justify-between">
          <h2 className="font-semibold text-surface-900 dark:text-surface-100 flex items-center gap-2">
            <FileText className="w-4 h-4 text-surface-400" />
            Recent Documents
          </h2>
          {totalDocs > 5 && (
            <button
              onClick={() => navigate('/documents')}
              className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
            >
              View all {totalDocs}
            </button>
          )}
        </div>

        {loading ? (
          <div className="divide-y divide-surface-100 dark:divide-surface-800">
            {[1, 2, 3].map(i => (
              <div key={i} className="px-6 py-4 flex items-center gap-4">
                <div className="w-8 h-8 rounded bg-surface-200 dark:bg-surface-800 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 bg-surface-200 dark:bg-surface-800 rounded animate-pulse" />
                  <div className="h-3 w-24 bg-surface-200 dark:bg-surface-800 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : recentDocs.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Cpu className="w-10 h-10 text-surface-300 dark:text-surface-600 mx-auto mb-3" />
            <p className="text-surface-500 text-sm">No documents uploaded yet.</p>
            <button
              onClick={() => navigate('/upload')}
              className="mt-4 text-sm text-primary-600 dark:text-primary-400 hover:underline"
            >
              Upload your first document →
            </button>
          </div>
        ) : (
          <div className="divide-y divide-surface-100 dark:divide-surface-800">
            {recentDocs.map(doc => (
              <div key={doc.id} className="px-6 py-4 flex items-center gap-4 hover:bg-surface-50 dark:hover:bg-surface-800/30 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-900 dark:text-surface-100 truncate">
                    {doc.original_filename}
                  </p>
                  <p className="text-xs text-surface-400 mt-0.5">
                    {formatBytes(doc.file_size)} · {new Date(doc.created_at).toLocaleDateString()}
                    {doc.chunk_count > 0 && ` · ${doc.chunk_count} chunks`}
                  </p>
                </div>
                <StatusBadge status={doc.status} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* System Info */}
      {health && (
        <section className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm p-6">
          <h2 className="font-semibold text-surface-900 dark:text-surface-100 mb-4 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-surface-400" />
            System Info
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            {[
              { label: 'Version',     value: health.version },
              { label: 'Environment', value: health.environment },
              { label: 'Documents',   value: health.documents_count },
              { label: 'Status',      value: health.status },
            ].map(item => (
              <div key={item.label}>
                <p className="text-surface-400 text-xs uppercase tracking-wide">{item.label}</p>
                <p className="font-medium text-surface-900 dark:text-surface-100 mt-1 capitalize">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
