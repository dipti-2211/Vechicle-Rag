import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { LoadingSpinner } from './components/ui/Loading'

// Code-split all page components — each page is loaded only when first visited.
const Landing   = lazy(() => import('./pages/Landing'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Chat      = lazy(() => import('./pages/Chat'))
const Documents = lazy(() => import('./pages/Documents'))
const Upload    = lazy(() => import('./pages/Upload'))
const Settings  = lazy(() => import('./pages/Settings'))
const NotFound  = lazy(() => import('./pages/NotFound'))

/** Full-page suspense fallback shown while a lazy page chunk loads */
function PageLoading() {
  return (
    <div className="flex-1 flex items-center justify-center h-screen w-full bg-black">
      <LoadingSpinner size={40} />
    </div>
  )
}

/**
 * Main App Component
 *
 * Route map:
 *   /           → Landing  (IlluminatedHero with nav buttons, no AppLayout)
 *   /dashboard  → Dashboard  (inside AppLayout)
 *   /chat       → Chat        (inside AppLayout)
 *   /documents  → Documents   (inside AppLayout)
 *   /upload     → Upload      (inside AppLayout)
 *   /settings   → Settings    (inside AppLayout)
 *   *           → 404 NotFound (full-screen, no AppLayout)
 */
function App() {
  return (
    <Routes>
      {/* ── Landing — shown at root, full-screen, no top nav shell ── */}
      <Route
        path="/"
        element={
          <Suspense fallback={<PageLoading />}>
            <Landing />
          </Suspense>
        }
      />

      {/* ── App pages — wrapped in AppLayout shell ── */}
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<Suspense fallback={<PageLoading />}><Dashboard /></Suspense>} />
        <Route path="/chat"      element={<Suspense fallback={<PageLoading />}><Chat /></Suspense>} />
        <Route path="/documents" element={<Suspense fallback={<PageLoading />}><Documents /></Suspense>} />
        <Route path="/upload"    element={<Suspense fallback={<PageLoading />}><Upload /></Suspense>} />
        <Route path="/settings"  element={<Suspense fallback={<PageLoading />}><Settings /></Suspense>} />
      </Route>

      {/* ── 404 — full-screen, no AppLayout ── */}
      <Route
        path="*"
        element={
          <Suspense fallback={<PageLoading />}>
            <NotFound />
          </Suspense>
        }
      />
    </Routes>
  )
}

export default App
