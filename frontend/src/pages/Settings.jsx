import { useState, useEffect } from 'react';
import { RefreshCw, Server, Cpu, Layers } from 'lucide-react';
import api from '../api/axios';

function InfoRow({ label, value, mono = false }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-surface-100 dark:border-surface-800 last:border-0">
      <span className="text-sm text-surface-600 dark:text-surface-400">{label}</span>
      <span className={`text-sm font-medium text-surface-900 dark:text-surface-100 ${mono ? 'font-mono' : ''}`}>
        {value ?? '—'}
      </span>
    </div>
  );
}

export default function Settings() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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
      <header>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-surface-100">Settings</h1>
        <p className="text-surface-500 mt-1">Application preferences and system information.</p>
      </header>

      {/* Appearance */}
      <section className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm p-6">
        <h2 className="font-semibold text-surface-900 dark:text-surface-100 mb-1 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-surface-400" />
          Appearance
        </h2>
        <p className="text-sm text-surface-500 mb-4">Toggle dark/light mode using the button in the sidebar.</p>
        <div className="py-3 border-t border-surface-100 dark:border-surface-800 text-sm text-surface-500">
          Theme preference is saved to localStorage and respects your OS preference on first visit.
        </div>
      </section>

      {/* Backend Status */}
      <section className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-200 dark:border-surface-800 flex items-center justify-between">
          <h2 className="font-semibold text-surface-900 dark:text-surface-100 flex items-center gap-2">
            <Server className="w-4 h-4 text-surface-400" />
            Backend Status
          </h2>
          <div className="flex items-center gap-3">
            {loading ? (
              <span className="text-xs text-surface-400 animate-pulse">Checking...</span>
            ) : (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                isOnline
                  ? 'bg-accent-100 text-accent-700 dark:bg-accent-500/10 dark:text-accent-400'
                  : 'bg-danger-100 text-danger-700 dark:bg-danger-500/10 dark:text-danger-400'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-accent-500 animate-pulse' : 'bg-danger-500'}`} />
                {isOnline ? 'Connected' : 'Offline'}
              </span>
            )}
            <button
              onClick={checkHealth}
              disabled={loading}
              className="p-1.5 rounded-lg text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="px-6 py-2">
          {loading ? (
            <div className="space-y-3 py-4">
              {[1,2,3].map(i => (
                <div key={i} className="flex justify-between">
                  <div className="h-4 w-24 bg-surface-200 dark:bg-surface-800 rounded animate-pulse" />
                  <div className="h-4 w-32 bg-surface-200 dark:bg-surface-800 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="py-6 text-center text-sm text-danger-500">
              Could not reach the backend. Make sure the server is running on port 8000.
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

      {/* Tech Stack */}
      <section className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm p-6">
        <h2 className="font-semibold text-surface-900 dark:text-surface-100 mb-4 flex items-center gap-2">
          <Layers className="w-4 h-4 text-surface-400" />
          Tech Stack
        </h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            { label: 'Frontend',    value: 'React 19 + Vite + Tailwind v4' },
            { label: 'Backend',     value: 'FastAPI + Python' },
            { label: 'Database',    value: 'SQLite (aiosqlite)' },
            { label: 'Vector DB',   value: 'ChromaDB (local)' },
            { label: 'Embeddings',  value: 'all-MiniLM-L6-v2' },
            { label: 'LLM',         value: 'Gemini 2.0 Flash' },
          ].map(item => (
            <div key={item.label} className="p-3 rounded-xl bg-surface-50 dark:bg-surface-800">
              <p className="text-xs text-surface-400 uppercase tracking-wide">{item.label}</p>
              <p className="font-medium text-surface-900 dark:text-surface-100 mt-1 text-xs leading-snug">{item.value}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
