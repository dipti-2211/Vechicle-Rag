export default function Settings() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-surface-100">Settings</h1>
        <p className="text-surface-500 mt-2">Manage your app preferences and configurations.</p>
      </header>

      <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 shadow-sm divide-y divide-surface-200 dark:divide-surface-800">
        <div className="p-6">
          <h3 className="text-lg font-medium text-surface-900 dark:text-surface-100">Appearance</h3>
          <p className="text-sm text-surface-500 mt-1">Customize how the app looks.</p>
          
          <div className="mt-4 flex items-center justify-between py-2">
            <div>
              <p className="font-medium text-surface-900 dark:text-surface-100">Theme</p>
              <p className="text-sm text-surface-500">Toggle dark/light mode from the sidebar.</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <h3 className="text-lg font-medium text-surface-900 dark:text-surface-100">System Info</h3>
          
          <div className="mt-4 space-y-3">
            <div className="flex justify-between py-2 border-b border-surface-100 dark:border-surface-800/50">
              <span className="text-surface-600 dark:text-surface-400">Version</span>
              <span className="font-medium text-surface-900 dark:text-surface-100">1.0.0</span>
            </div>
            <div className="flex justify-between py-2 border-b border-surface-100 dark:border-surface-800/50">
              <span className="text-surface-600 dark:text-surface-400">Environment</span>
              <span className="font-medium text-surface-900 dark:text-surface-100">Development</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-surface-600 dark:text-surface-400">Backend Status</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent-100 text-accent-800 dark:bg-accent-500/10 dark:text-accent-400">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-500 animate-pulse-soft"></span>
                Connected
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
