export default function Dashboard() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-surface-100">Dashboard</h1>
        <p className="text-surface-500 mt-2">Overview of your vehicle intelligence system.</p>
      </header>

      {/* Skeletons for future content */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white dark:bg-surface-900 p-6 rounded-xl border border-surface-200 dark:border-surface-800 shadow-sm">
            <div className="h-4 w-24 bg-surface-200 dark:bg-surface-800 rounded animate-pulse mb-4"></div>
            <div className="h-8 w-16 bg-surface-200 dark:bg-surface-800 rounded animate-pulse"></div>
          </div>
        ))}
      </div>
      
      <div className="bg-white dark:bg-surface-900 p-6 rounded-xl border border-surface-200 dark:border-surface-800 shadow-sm min-h-[300px] flex items-center justify-center">
        <p className="text-surface-400">Dashboard content will be implemented in Milestone 7</p>
      </div>
    </div>
  );
}
