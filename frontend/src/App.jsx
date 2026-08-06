import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { LoadingSpinner } from './components/ui/Loading'

// Code-split all page components — each page is loaded only when first visited.
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Chat      = lazy(() => import('./pages/Chat'))
const Documents = lazy(() => import('./pages/Documents'))
const Upload    = lazy(() => import('./pages/Upload'))
const Settings  = lazy(() => import('./pages/Settings'))
const NotFound  = lazy(() => import('./pages/NotFound'))

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
 * The catch-all route shows a proper 404 Not Found page.
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

      {/* Proper 404 page — shown outside the AppLayout so it's full-screen */}
      <Route path="*" element={<Suspense fallback={<PageLoading />}><NotFound /></Suspense>} />
    </Routes>
  )
}

export default App
