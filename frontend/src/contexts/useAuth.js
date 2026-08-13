import { useContext } from 'react'
import { AuthContext } from './AuthContext'

/** Hook to access the authenticated user and auth actions. */
export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
