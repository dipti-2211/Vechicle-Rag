import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, MessageSquare, UploadCloud, CheckCircle,
  Loader2, AlertCircle, ArrowRight, Database,
  BarChart2, Zap, TrendingUp, ChevronRight,
  BookOpen, Clock, Star,
} from 'lucide-react';
import api from '../api/axios';
import { useDocumentPolling } from '../hooks/useDocumentPolling';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function StatusBadge({ status }) {
  const c = {
    ready:      { cls: 'badge-ready',      icon: CheckCircle, label: 'Ready',      spin: false },
    processing: { cls: 'badge-processing', icon: Loader2,     label: 'Processing', spin: true  },
    error:      { cls: 'badge-error',      icon: AlertCircle, label: 'Error',      spin: false },
  }[status] ?? { cls: 'badge-processing', icon: FileText, label: status, spin: false };
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${c.cls}`}>
      <Icon className={`w-3 h-3 ${c.spin ? 'animate-spin' : ''}`} />
      {c.label}
    </span>
  );
}

// Mini bar chart for document status distribution
function MiniBarChart({ ready = 0, processing = 0, error = 0 }) {
  const total = ready + processing + error || 1;
  const bars = [
    { value: ready,      color: 'from-emerald-400 to-emerald-500',  label: 'Ready',      count: ready },
    { value: processing, color: 'from-primary-400 to-primary-500',  label: 'Processing', count: processing },
    { value: error,      color: 'from-danger-400 to-danger-500',    label: 'Error',       count: error },
  ];
  return (
    <div className="space-y-3">
      {bars.map(b => (
        <div key={b.label} className="flex items-center gap-3">
          <span className="text-xs text-surface-500 dark:text-surface-400 w-20">{b.label}</span>
          <div className="flex-1 h-2 rounded-full bg-surface-200/50 dark:bg-white/6 overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${b.color} transition-all duration-1000`}
              style={{ width: `${(b.value / total) * 100}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-surface-700 dark:text-surface-300 w-6 text-right">{b.count}</span>
        </div>
      ))}
    </div>
  );
}

// Stat card
function StatCard({ label, value, icon: Icon, gradient, sub, onClick }) {
  return (
    <button
      onClick={onClick}
      className="glass rounded-2xl p-5 text-left stat-card-accent hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group glow-border w-full"
      style={{ '--accent-from': gradient[0], '--accent-to': gradient[1] }}
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
          style={{ background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})` }}
        >
          <Icon className="w-5 h-5 text-white" />
        </div>
        <ChevronRight className="w-4 h-4 text-surface-300 dark:text-surface-600 group-hover:text-primary-400 transition-colors" />
      </div>
      <p className="text-3xl font-bold text-surface-900 dark:text-surface-100">{value}</p>
      <p className="text-sm font-medium text-surface-600 dark:text-surface-400 mt-1">{label}</p>
      {sub && <p className="text-xs text-surface-400 mt-0.5">{sub}</p>}
    </button>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats]         = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [docs, setDocs]           = useState([]);
  const [loading, setLoading]     = useState(true);

  const fetchAll = async () => {
    try {
      const [statsRes, analyticsRes, docsRes] = await Promise.all([
        api.get('/api/documents/stats'),
        api.get('/api/chat/analytics').catch(() => ({ data: null })),
        api.get('/api/documents?status=ready').catch(() => ({ data: { documents: [] } })),
      ]);
      setStats(statsRes.data);
      setAnalytics(analyticsRes.data);
      setDocs(docsRes.data.documents?.slice(0, 5) ?? []);
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  // Poll when documents are processing
  useDocumentPolling(
    stats?.processing > 0,
    () => api.get('/api/documents/stats').then(r => setStats(r.data)),
    4000,
  );

  const skeleton = (
    <div className="animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[1,2,3,4].map(i => <div key={i} className="glass rounded-2xl h-36" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass rounded-2xl h-64 col-span-2" />
        <div className="glass rounded-2xl h-64" />
      </div>
    </div>
  );

  if (loading) return skeleton;

  const totalDocs  = stats?.total ?? 0;
  const readyDocs  = stats?.ready ?? 0;
  const totalChunks = stats?.total_chunks ?? 0;
  const totalSize  = formatBytes(stats?.total_size_bytes ?? 0);
  const totalConvs = analytics?.total_conversations ?? 0;
  const totalMsgs  = analytics?.total_messages ?? 0;

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Hero Header ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden glass rounded-3xl p-6 md:p-8 border border-white/20 dark:border-white/6">
        {/* Background gradient orbs */}
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-primary-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-8 w-48 h-48 rounded-full bg-accent-500/10 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl btn-gradient flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-widest text-primary-400">
                Vehicle Intelligence
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-surface-900 dark:text-white">
              AI Dashboard
            </h1>
            <p className="text-surface-500 dark:text-surface-400 mt-1 text-sm max-w-lg">
              Your fleet documents are indexed and ready. Ask questions about any vehicle in your library.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/upload')}
              className="flex items-center gap-2 px-4 py-2.5 glass rounded-xl border border-white/20 dark:border-white/8 text-sm font-medium text-surface-700 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white transition-all"
            >
              <UploadCloud className="w-4 h-4" />
              Upload
            </button>
            <button
              onClick={() => navigate('/chat')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl btn-gradient text-sm font-semibold shadow-lg shadow-primary-500/30"
            >
              <MessageSquare className="w-4 h-4" />
              Ask AI
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Stat Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Documents"
          value={totalDocs}
          icon={FileText}
          gradient={['#6366f1', '#4f46e5']}
          sub={totalDocs === 0 ? 'Upload your first file' : `${readyDocs} ready`}
          onClick={() => navigate('/documents')}
        />
        <StatCard
          label="Vector Chunks"
          value={totalChunks.toLocaleString()}
          icon={Database}
          gradient={['#06b6d4', '#0891b2']}
          sub={totalSize + ' indexed'}
          onClick={() => navigate('/documents')}
        />
        <StatCard
          label="Conversations"
          value={totalConvs}
          icon={MessageSquare}
          gradient={['#8b5cf6', '#6d28d9']}
          sub={totalMsgs > 0 ? `${totalMsgs} messages` : 'Start chatting'}
          onClick={() => navigate('/chat')}
        />
        <StatCard
          label="AI Queries"
          value={totalMsgs}
          icon={BarChart2}
          gradient={['#10b981', '#059669']}
          sub="Powered by Gemini"
          onClick={() => navigate('/chat')}
        />
      </div>

      {/* ── Bottom Section ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Recent documents */}
        <div className="lg:col-span-2 glass rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-200/50 dark:border-white/6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary-400" />
              <h2 className="font-semibold text-surface-900 dark:text-surface-100 text-sm">
                Indexed Documents
              </h2>
            </div>
            <button
              onClick={() => navigate('/documents')}
              className="flex items-center gap-1 text-xs font-medium text-primary-400 hover:text-primary-300 transition-colors"
            >
              View all <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
              <div className="w-12 h-12 rounded-2xl glass flex items-center justify-center mb-3">
                <UploadCloud className="w-6 h-6 text-surface-400" />
              </div>
              <p className="text-sm text-surface-500 dark:text-surface-400">No ready documents yet</p>
              <button
                onClick={() => navigate('/upload')}
                className="mt-3 text-sm font-medium text-primary-400 hover:text-primary-300 transition-colors flex items-center gap-1"
              >
                Upload a file <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="divide-y divide-surface-200/40 dark:divide-white/4">
              {docs.map(doc => (
                <div key={doc.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-50/50 dark:hover:bg-white/3 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-primary-500/10 border border-primary-500/20 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-primary-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">
                      {doc.original_filename}
                    </p>
                    <p className="text-xs text-surface-400 mt-0.5">
                      {doc.chunk_count} chunks · {formatBytes(doc.file_size)}
                    </p>
                  </div>
                  <StatusBadge status={doc.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Status Distribution */}
        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-200/50 dark:border-white/6 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-accent-400" />
            <h2 className="font-semibold text-surface-900 dark:text-surface-100 text-sm">
              Status Distribution
            </h2>
          </div>
          <div className="p-5 space-y-6">
            <MiniBarChart
              ready={stats?.ready ?? 0}
              processing={stats?.processing ?? 0}
              error={stats?.error ?? 0}
            />

            {/* Quick actions */}
            <div className="pt-4 border-t border-surface-200/40 dark:border-white/5 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-surface-400 mb-3">Quick Actions</p>
              {[
                { label: 'Upload Document',    icon: UploadCloud, path: '/upload',    color: 'text-accent-400' },
                { label: 'Browse Documents',   icon: FileText,    path: '/documents', color: 'text-primary-400' },
                { label: 'Start New Chat',     icon: MessageSquare, path: '/chat',   color: 'text-emerald-400' },
              ].map(a => (
                <button
                  key={a.path}
                  onClick={() => navigate(a.path)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-100/50 dark:hover:bg-white/4 transition-all group"
                >
                  <a.icon className={`w-4 h-4 ${a.color}`} />
                  <span className="text-sm text-surface-700 dark:text-surface-300 group-hover:text-surface-900 dark:group-hover:text-white transition-colors">
                    {a.label}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-surface-300 dark:text-surface-600 ml-auto group-hover:text-primary-400 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* ── Processing warning ───────────────────────────────────────── */}
      {(stats?.processing ?? 0) > 0 && (
        <div className="glass rounded-2xl px-5 py-4 border border-primary-500/20 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-primary-400 animate-spin flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-surface-800 dark:text-surface-200">
              {stats.processing} document{stats.processing !== 1 ? 's' : ''} being processed
            </p>
            <p className="text-xs text-surface-400 mt-0.5">
              This page updates automatically. Parsing → Chunking → Embedding in progress.
            </p>
          </div>
        </div>
      )}

      {/* ── Error warning ────────────────────────────────────────────── */}
      {(stats?.error ?? 0) > 0 && (
        <div className="glass rounded-2xl px-5 py-4 border border-danger-500/20 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-danger-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-surface-800 dark:text-surface-200">
              {stats.error} document{stats.error !== 1 ? 's' : ''} failed to process
            </p>
            <p className="text-xs text-surface-400 mt-0.5">
              Go to Documents to view errors and re-upload if needed.
            </p>
          </div>
          <button
            onClick={() => navigate('/documents')}
            className="ml-auto flex-shrink-0 flex items-center gap-1 text-xs text-danger-400 hover:text-danger-300 font-medium transition-colors"
          >
            View <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
