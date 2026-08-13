import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { LoadingSpinner } from './components/ui/Loading'
import ProtectedRoute from './components/ProtectedRoute'

// Code-split all page components — each page is loaded only when first visited.
const Landing   = lazy(() => import('./pages/Landing'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Chat      = lazy(() => import('./pages/Chat'))
const Documents = lazy(() => import('./pages/Documents'))
const Upload    = lazy(() => import('./pages/Upload'))
const Settings  = lazy(() => import('./pages/Settings'))
const NotFound  = lazy(() => import('./pages/NotFound'))
const Login     = lazy(() => import('./pages/Login'))
const Signup    = lazy(() => import('./pages/Signup'))

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
 *   /           → Landing  (public, full-screen, no AppLayout)
 *   /login      → Login    (public, no AppLayout)
 *   /signup     → Signup   (public, no AppLayout)
 *   /dashboard  → Dashboard  (protected, inside AppLayout)
 *   /chat       → Chat        (protected, inside AppLayout)
 *   /documents  → Documents   (protected, inside AppLayout)
 *   /upload     → Upload      (protected, inside AppLayout)
 *   /settings   → Settings    (protected, inside AppLayout)
 *   *           → 404 NotFound (full-screen, no AppLayout)
 */
function App() {
  return (
    <Routes>
      {/* ── Public pages — no auth required ── */}
      <Route
        path="/"
        element={
          <Suspense fallback={<PageLoading />}>
            <Landing />
          </Suspense>
        }
      />
      <Route
        path="/login"
        element={
          <Suspense fallback={<PageLoading />}>
            <Login />
          </Suspense>
        }
      />
      <Route
        path="/signup"
        element={
          <Suspense fallback={<PageLoading />}>
            <Signup />
          </Suspense>
        }
      />

      {/* ── Protected app pages — require authentication ── */}
      <Route element={<AppLayout />}>
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoading />}><Dashboard /></Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoading />}><Chat /></Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/documents"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoading />}><Documents /></Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/upload"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoading />}><Upload /></Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoading />}><Settings /></Suspense>
            </ProtectedRoute>
          }
        />
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
