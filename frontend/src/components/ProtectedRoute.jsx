/**
 * ProtectedRoute — redirects unauthenticated visitors to /login.
 *
 * While auth state is loading, shows a full-screen spinner to avoid
 * a flash of the login page on refresh with a valid session.
 */
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import { LoadingSpinner } from './ui/Loading'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen w-full bg-[#050505]">
        <LoadingSpinner size={40} />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}
