export default function Upload() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header className="text-center">
        <h1 className="text-3xl font-bold text-surface-900 dark:text-surface-100">Upload Document</h1>
        <p className="text-surface-500 mt-2">Upload PDFs, CSVs, or text files for the assistant to analyze.</p>
      </header>

      <div className="mt-8 bg-white dark:bg-surface-900 rounded-xl border-2 border-dashed border-surface-300 dark:border-surface-700 p-12 flex flex-col items-center justify-center text-center hover:border-primary-500 hover:bg-primary-50/50 dark:hover:bg-primary-900/10 transition-colors cursor-pointer">
        <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-surface-900 dark:text-surface-100">Drag & drop files here</h3>
        <p className="text-surface-500 mt-1 mb-4">or click to browse from your computer</p>
        <span className="text-xs text-surface-400">Upload functionality will be implemented in Milestone 4</span>
      </div>
    </div>
  );
}
