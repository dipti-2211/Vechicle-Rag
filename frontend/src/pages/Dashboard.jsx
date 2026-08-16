import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, MessageSquare, UploadCloud, CheckCircle,
  Loader2, AlertCircle, ArrowRight, Database,
  BarChart2, Zap, TrendingUp, ChevronRight,
  BookOpen, Terminal,
} from 'lucide-react';

import api from '../api/axios';

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
    { value: error,      color: 'from-danger-400 to-danger-500',    label: 'Error',      count: error },
  ];
  return (
    <div className="space-y-4">
      {bars.map(b => (
        <div key={b.label} className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400">{b.label}</span>
            <span className="text-xs font-semibold text-white/70">{b.count}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${b.color} transition-all duration-1000`}
              style={{ width: `${(b.value / total) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// Bento stat card — reference design language
function StatCard({ label, value, icon: Icon, gradient, sub, onClick }) {
  return (
    <button
      onClick={onClick}
      className="bento-card flex flex-col min-h-[160px] text-left group w-full"
      id={`stat-card-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {/* Visual area */}
      <div className="flex flex-1 flex-col justify-between p-5">
        <div className="flex items-start justify-between">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shadow-lg"
            style={{ background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})` }}
          >
            <Icon className="w-4 h-4 text-white" />
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 transition-colors" />
        </div>
        <div>
          <p className="text-2xl font-semibold text-white tracking-tight">{value}</p>
          {sub && <p className="text-[11px] text-neutral-500 mt-0.5">{sub}</p>}
        </div>
      </div>
      {/* Footer */}
      <div className="bento-footer">
        <p className="text-xs font-medium text-neutral-400">{label}</p>
      </div>
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

  // ── Controlled stats polling while any document is processing ────────────
  // IMPORTANT: do NOT use useDocumentPolling() here — that hook only accepts
  // (intervalMs) as its argument. Passing (boolean, fn, number) sets
  // intervalMs=1 (true→1), causing ~1000 requests/second (request storm).
  const statsTimerRef = useRef(null);
  useEffect(() => {
    if (stats?.processing > 0) {
      // Some docs still processing — poll stats every 5 s
      if (!statsTimerRef.current) {
        statsTimerRef.current = setInterval(async () => {
          try {
            const r = await api.get('/api/documents/stats');
            setStats(r.data);
          } catch {
            // ignore transient fetch errors during polling
          }
        }, 5000);
      }
    } else {
      // All settled — stop polling
      if (statsTimerRef.current) {
        clearInterval(statsTimerRef.current);
        statsTimerRef.current = null;
      }
    }
    return () => {
      if (statsTimerRef.current) {
        clearInterval(statsTimerRef.current);
        statsTimerRef.current = null;
      }
    };
  }, [stats?.processing]);

  // Skeleton
  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="bento-card h-36" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="bento-card h-40" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bento-card h-72 lg:col-span-2" />
        <div className="bento-card h-72" />
      </div>
    </div>
  );

  const totalDocs   = stats?.total ?? 0;
  const readyDocs   = stats?.ready ?? 0;
  const totalChunks = stats?.total_chunks ?? 0;
  const totalSize   = formatBytes(stats?.total_size_bytes ?? 0);
  const totalConvs  = analytics?.total_conversations ?? 0;
  const totalMsgs   = analytics?.total_messages ?? 0;

  return (
    <div className="space-y-4 animate-fade-in">

      {/* Hero Banner */}
      <div className="bento-card relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-indigo-500/5 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-10 w-56 h-56 rounded-full bg-cyan-500/5 blur-3xl pointer-events-none" />

        <div className="relative px-6 py-6 md:px-8 md:py-7">
          <div className="mb-4 inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[11px] font-medium uppercase tracking-widest text-neutral-500">
            <Zap className="w-3 h-3 mr-1.5 text-indigo-400" />
            Vehicle Intelligence
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5">
            <div>
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-1.5">
                AI Dashboard
              </h1>
              <p className="text-sm text-neutral-500 max-w-md leading-relaxed">
                Fleet documents indexed and ready. Ask questions about any vehicle in your library.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                id="hero-upload-btn"
                onClick={() => navigate('/upload')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-sm font-medium text-neutral-300 hover:text-white hover:border-white/[0.15] hover:bg-white/[0.06] transition-all"
              >
                <UploadCloud className="w-4 h-4" />
                Upload
              </button>
              <button
                id="hero-askai-btn"
                onClick={() => navigate('/chat')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg btn-gradient text-sm font-semibold shadow-lg shadow-indigo-500/20"
              >
                <MessageSquare className="w-4 h-4" />
                Ask AI
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
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

      {/* Main Content — Bento 3-col */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Indexed Documents — wide card */}
        <div className="bento-card flex flex-col lg:col-span-2">
          {/* Header row */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.04]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
              </div>
              <h2 className="text-sm font-medium text-white">Indexed Documents</h2>
            </div>
            <button
              id="view-all-docs-btn"
              onClick={() => navigate('/documents')}
              className="flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-white transition-colors"
            >
              View all <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Document list */}
          {docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center flex-1">
              <div className="w-12 h-12 rounded-xl border border-white/[0.08] bg-white/[0.02] flex items-center justify-center mb-3">
                <UploadCloud className="w-5 h-5 text-neutral-600" />
              </div>
              <p className="text-sm text-neutral-500">No ready documents yet</p>
              <button
                id="upload-link-empty"
                onClick={() => navigate('/upload')}
                className="mt-3 text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
              >
                Upload a file <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04] flex-1">
              {docs.map((doc, idx) => (
                <div key={doc.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition-colors group">
                  <span className="text-[11px] font-mono text-neutral-700 w-5 text-right flex-shrink-0">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <div className="w-7 h-7 rounded-md border border-white/[0.06] bg-white/[0.03] flex items-center justify-center flex-shrink-0">
                    <FileText className="w-3.5 h-3.5 text-indigo-400/70" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-200 truncate group-hover:text-white transition-colors">
                      {doc.original_filename}
                    </p>
                    <p className="text-[11px] text-neutral-600 mt-0.5 font-mono">
                      {doc.chunk_count} chunks · {formatBytes(doc.file_size)}
                    </p>
                  </div>
                  <StatusBadge status={doc.status} />
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="bento-footer flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-neutral-600" />
              <span className="text-[11px] font-mono text-neutral-600">
                {readyDocs} / {totalDocs} ready
              </span>
            </div>
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
        </div>

        {/* Status Distribution + Quick Actions */}
        <div className="bento-card flex flex-col">
          {/* Header row */}
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/[0.04]">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <h2 className="text-sm font-medium text-white">Status Distribution</h2>
          </div>

          <div className="p-5 flex-1 flex flex-col">
            <MiniBarChart
              ready={stats?.ready ?? 0}
              processing={stats?.processing ?? 0}
              error={stats?.error ?? 0}
            />

            <div className="my-5 border-t border-white/[0.04]" />

            {/* Quick Actions */}
            <div className="space-y-1 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-700 mb-3">
                Quick Actions
              </p>
              {[
                { label: 'Upload Document',  icon: UploadCloud,   path: '/upload',    color: 'text-cyan-400',    bg: 'bg-cyan-500/10 border-cyan-500/20'     },
                { label: 'Browse Documents', icon: FileText,      path: '/documents', color: 'text-indigo-400',  bg: 'bg-indigo-500/10 border-indigo-500/20' },
                { label: 'Start New Chat',   icon: MessageSquare, path: '/chat',      color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
              ].map(a => (
                <button
                  key={a.path}
                  id={`quick-action-${a.path.replace('/', '')}`}
                  onClick={() => navigate(a.path)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-transparent hover:border-white/[0.06] hover:bg-white/[0.03] transition-all group"
                >
                  <div className={`w-6 h-6 rounded-md border flex items-center justify-center flex-shrink-0 ${a.bg}`}>
                    <a.icon className={`w-3 h-3 ${a.color}`} />
                  </div>
                  <span className="text-sm text-neutral-400 group-hover:text-neutral-200 transition-colors">
                    {a.label}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-neutral-700 ml-auto group-hover:text-neutral-400 transition-colors" />
                </button>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="bento-footer">
            <p className="text-[11px] font-mono text-neutral-600">
              {stats?.total ?? 0} total · {stats?.error ?? 0} errors
            </p>
          </div>
        </div>

      </div>

      {/* Processing warning */}
      {(stats?.processing ?? 0) > 0 && (
        <div
          className="bento-card px-5 py-4 flex items-center gap-3"
          style={{ borderColor: 'rgba(99,102,241,0.25)' }}
        >
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
            <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-neutral-200">
              {stats.processing} document{stats.processing !== 1 ? 's' : ''} being processed
            </p>
            <p className="text-xs text-neutral-600 mt-0.5">
              Parsing → Chunking → Embedding in progress. This page updates automatically.
            </p>
          </div>
          <div className="h-2 w-2 rounded-full bg-indigo-400 ring-pulse flex-shrink-0" />
        </div>
      )}

      {/* Error warning */}
      {(stats?.error ?? 0) > 0 && (
        <div
          className="bento-card px-5 py-4 flex items-center gap-3"
          style={{ borderColor: 'rgba(239,68,68,0.2)' }}
        >
          <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-4 h-4 text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-neutral-200">
              {stats.error} document{stats.error !== 1 ? 's' : ''} failed to process
            </p>
            <p className="text-xs text-neutral-600 mt-0.5">
              Go to Documents to view errors and re-upload if needed.
            </p>
          </div>
          <button
            id="view-errors-btn"
            onClick={() => navigate('/documents')}
            className="flex-shrink-0 flex items-center gap-1 text-xs text-red-400 hover:text-red-300 font-medium transition-colors"
          >
            View <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

    </div>
  );
}
