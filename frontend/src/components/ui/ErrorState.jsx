import { AlertCircle, RefreshCw } from 'lucide-react';

export function ErrorState({ title = "Something went wrong", message, onRetry }) {
  return (
    <div className="flex h-full min-h-[50vh] flex-col items-center justify-center p-6 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-full bg-danger-500/10 flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8 text-danger-500" />
      </div>
      <h3 className="text-xl font-semibold text-surface-900 dark:text-surface-100 mb-2">
        {title}
      </h3>
      {message && (
        <p className="text-surface-500 max-w-md mb-6">
          {message}
        </p>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-surface-100 hover:bg-surface-200 dark:bg-surface-800 dark:hover:bg-surface-700 text-surface-900 dark:text-surface-100 rounded-lg transition-colors font-medium text-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
      )}
    </div>
  );
}
