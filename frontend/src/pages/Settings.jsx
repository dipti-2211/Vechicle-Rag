import { useState, useEffect } from 'react';
import { RefreshCw, Server, Cpu, Layers, CheckCircle, XCircle, Zap } from 'lucide-react';
import api from '../api/axios';

function InfoRow({ label, value, mono = false }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-surface-200/40 dark:border-white/5 last:border-0">
      <span className="text-sm text-surface-500 dark:text-surface-400">{label}</span>
      <span className={`text-sm font-semibold text-surface-800 dark:text-surface-200 ${mono ? 'font-mono text-xs' : ''}`}>
        {value ?? '—'}
      </span>
    </div>
  );
}

function StackBadge({ label, value }) {
  return (
    <div className="glass rounded-2xl p-4 border border-white/10 dark:border-white/5 hover:shadow-md transition-all">
      <p className="text-xs font-bold uppercase tracking-widest text-surface-400 mb-1">{label}</p>
      <p className="text-sm font-semibold text-surface-800 dark:text-surface-200 leading-snug">{value}</p>
    </div>
  );
}

export default function Settings() {
  const [health, setHealth]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  const checkHealth = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get('/health');
      setHealth(res.data);
    } catch {
      setError(true);
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { checkHealth(); }, []);

  const isOnline = !loading && !error && health;

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-3xl font-extrabold text-surface-900 dark:text-white">Settings</h1>
        <p className="text-surface-500 dark:text-surface-400 mt-1 text-sm">
          Application configuration and system status.
        </p>
      </div>

      {/* ── Appearance ───────────────────────────────────────────────── */}
      <section className="glass rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-200/50 dark:border-white/6 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-primary-400" />
          <h2 className="font-semibold text-surface-900 dark:text-surface-100 text-sm">Appearance</h2>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-surface-600 dark:text-surface-400">
            Use the <span className="font-semibold text-surface-800 dark:text-surface-200">sun/moon icon</span> in the top navigation to switch between light and dark mode.
          </p>
          <div className="text-xs text-surface-400 glass rounded-xl p-3 border border-white/10 dark:border-white/5">
            Theme preference is persisted to <code className="text-primary-400 font-mono">localStorage</code> and respects your OS setting on first visit.
          </div>
        </div>
      </section>

      {/* ── Backend Status ────────────────────────────────────────────── */}
      <section className="glass rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-200/50 dark:border-white/6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-accent-400" />
            <h2 className="font-semibold text-surface-900 dark:text-surface-100 text-sm">Backend Status</h2>
          </div>
          <div className="flex items-center gap-3">
            {loading ? (
              <span className="text-xs text-surface-400 animate-pulse">Checking…</span>
            ) : (
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                isOnline ? 'badge-ready' : 'badge-error'
              }`}>
                {isOnline
                  ? <CheckCircle className="w-3 h-3" />
                  : <XCircle className="w-3 h-3" />
                }
                {isOnline ? 'Connected' : 'Offline'}
              </span>
            )}
            <button
              onClick={checkHealth}
              disabled={loading}
              className="p-2 rounded-xl glass border border-white/10 dark:border-white/6 text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 transition-all disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="px-5 py-2">
          {loading ? (
            <div className="space-y-3 py-4">
              {[1,2,3].map(i => (
                <div key={i} className="flex justify-between">
                  <div className="h-4 w-24 bg-surface-200/60 dark:bg-white/6 rounded animate-pulse" />
                  <div className="h-4 w-32 bg-surface-200/60 dark:bg-white/6 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="py-6 text-center">
              <XCircle className="w-8 h-8 text-danger-400 mx-auto mb-2" />
              <p className="text-sm text-surface-500 dark:text-surface-400">
                Could not reach the backend. Make sure the server is running on port <code className="text-primary-400 font-mono">8000</code>.
              </p>
            </div>
          ) : health ? (
            <>
              <InfoRow label="App Name"          value={health.app} />
              <InfoRow label="Version"           value={health.version} mono />
              <InfoRow label="Environment"       value={health.environment} />
              <InfoRow label="Status"            value={health.status} />
              <InfoRow label="Documents Indexed" value={health.documents_count} />
              <InfoRow label="Last Checked"      value={new Date(health.timestamp).toLocaleString()} />
            </>
          ) : null}
        </div>
      </section>

      {/* ── Tech Stack ────────────────────────────────────────────────── */}
      <section className="glass rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-200/50 dark:border-white/6 flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-400" />
          <h2 className="font-semibold text-surface-900 dark:text-surface-100 text-sm">Tech Stack</h2>
        </div>
        <div className="p-4 grid grid-cols-2 gap-3">
          {[
            { label: 'Frontend',    value: 'React 19 · Vite · Tailwind v4' },
            { label: 'Backend',     value: 'FastAPI · Python 3.12' },
            { label: 'Database',    value: 'SQLite (aiosqlite)' },
            { label: 'Vector DB',   value: 'ChromaDB (local persistent)' },
            { label: 'Embeddings',  value: 'all-MiniLM-L6-v2 (384-dim)' },
            { label: 'LLM',         value: 'Gemini 2.0 Flash' },
          ].map(item => <StackBadge key={item.label} {...item} />)}
        </div>
      </section>

      {/* ── Branding footer ───────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-2 text-xs text-surface-400 py-2">
        <Zap className="w-3.5 h-3.5 text-primary-400" />
        <span className="gradient-text font-semibold">Vehicle Intelligence Assistant</span>
        <span>· v1.0.0</span>
      </div>
    </div>
  );
}
