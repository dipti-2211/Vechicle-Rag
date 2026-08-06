import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { LoadingSpinner } from './components/ui/Loading'

// Code-split all page components — each page is loaded only when first visited.
// This eliminates the >500 KB bundle warning and improves initial load time.
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Chat      = lazy(() => import('./pages/Chat'))
const Documents = lazy(() => import('./pages/Documents'))
const Upload    = lazy(() => import('./pages/Upload'))
const Settings  = lazy(() => import('./pages/Settings'))

/** Full-page suspense fallback shown while a lazy page chunk loads */
function PageLoading() {
  return (
    <div className="flex-1 flex items-center justify-center h-full min-h-[60vh]">
      <LoadingSpinner size={40} />
    </div>
  )
}

/**
 * Main App Component
 * Sets up routing with lazy-loaded pages inside the AppLayout shell.
 * All page routes are wrapped in Suspense for graceful loading states.
 */
function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        {/* Redirect root to dashboard */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Main application pages — each loaded on demand */}
        <Route path="/dashboard" element={<Suspense fallback={<PageLoading />}><Dashboard /></Suspense>} />
        <Route path="/chat"      element={<Suspense fallback={<PageLoading />}><Chat /></Suspense>} />
        <Route path="/documents" element={<Suspense fallback={<PageLoading />}><Documents /></Suspense>} />
        <Route path="/upload"    element={<Suspense fallback={<PageLoading />}><Upload /></Suspense>} />
        <Route path="/settings"  element={<Suspense fallback={<PageLoading />}><Settings /></Suspense>} />
      </Route>

      {/* Catch-all route */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default App
