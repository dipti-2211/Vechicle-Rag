import { Loader2 } from 'lucide-react';

export function LoadingSpinner({ size = 24, className = "" }) {
  return (
    <div className={`flex justify-center items-center ${className}`}>
      <Loader2 className="animate-spin text-primary-500" size={size} />
    </div>
  );
}

export function PageLoading() {
  return (
    <div className="flex h-full min-h-[50vh] flex-col items-center justify-center space-y-4">
      <LoadingSpinner size={40} />
      <p className="text-surface-500 text-sm animate-pulse">Loading content...</p>
    </div>
  );
}
