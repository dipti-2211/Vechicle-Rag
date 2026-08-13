/**
 * AuthContext — provides Supabase Auth state to the entire app.
 *
 * Exposes: user, session, loading, signIn, signUp, signOut
 *
 * On new signup: calls POST /api/auth/initialize-user to seed demo documents
 * for the new user (idempotent — backend checks before seeding).
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { supabase } from '../lib/supabase'
import api from '../api/axios'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  // Track which user IDs have already been initialized in this browser session
  // to avoid re-calling initialize-user on every tab focus / token refresh.
  const initializedRef = useRef(new Set())

  // ── Initialize demo data for a brand-new user ─────────────────────
  const initializeUser = async (accessToken) => {
    try {
      await api.post(
        '/api/auth/initialize-user',
        {},
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
    } catch (err) {
      // Non-fatal — user can still use the app; demo data will be missing
      console.warn('[Auron] User initialization failed:', err?.response?.data ?? err.message)
    }
  }

  // ── Listen for auth state changes ─────────────────────────────────
  useEffect(() => {
    // Get the initial session (handles page refreshes / persistent sessions)
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      setUser(s?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        setSession(s)
        setUser(s?.user ?? null)
        setLoading(false)

        // Seed demo data exactly once per new signup
        if (
          event === 'SIGNED_IN' &&
          s?.user &&
          !initializedRef.current.has(s.user.id)
        ) {
          initializedRef.current.add(s.user.id)
          await initializeUser(s.access_token)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // ── Auth actions ──────────────────────────────────────────────────
  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  const signUp = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    return data
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  const value = { user, session, loading, signIn, signUp, signOut }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export { AuthContext }
