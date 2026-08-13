import { Zap } from 'lucide-react';

export default function Settings() {
  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">

      {/* ── Header ───────────────────────────────────────────────── */}
      <div>
        <h1 className="text-3xl font-extrabold text-surface-900 dark:text-white">Settings</h1>
        <p className="text-surface-500 dark:text-surface-400 mt-1 text-sm">
          Application preferences.
        </p>
      </div>

      {/* ── Branding footer ───────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-2 text-xs text-surface-400 py-2">
        <Zap className="w-3.5 h-3.5 text-primary-400" />
        <span className="gradient-text font-semibold">Auron</span>
      </div>
    </div>
  );
}
