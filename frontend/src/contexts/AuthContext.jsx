/**
 * AuthContext — provides Supabase Auth state to the entire app.
 *
 * Exposes:
 *   user              — Supabase User object (or null)
 *   session           — Supabase Session object (or null)
 *   loading           — true while initial session is being resolved
 *   isAnonymous       — true if the current user logged in anonymously
 *   signIn            — email + password sign-in
 *   signUp            — email + password sign-up (no captcha)
 *   signInWithGoogle  — Google OAuth (redirects back to app)
 *   signInAnonymously — Supabase anonymous auth (no captcha)
 *   signOut
 *
 * On new signup / first SIGNED_IN event: calls POST /api/auth/initialize-user
 * to seed demo documents for the user (idempotent — backend checks first).
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

// ── OAuth redirect URL ────────────────────────────────────────────────────────
// Works in both local dev (localhost:5173) and production (Render).
// VITE_SITE_URL is set in Render's env vars to the production URL.
// In local dev it falls back to window.location.origin (http://localhost:5173).
function getOAuthRedirectUrl() {
  if (import.meta.env.VITE_SITE_URL) {
    return import.meta.env.VITE_SITE_URL.replace(/\/$/, '') + '/dashboard'
  }
  if (typeof window !== 'undefined') {
    return window.location.origin + '/dashboard'
  }
  return 'http://localhost:5173/dashboard'
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  // Track which user IDs have already been initialized in this browser session
  // to avoid re-calling initialize-user on every tab focus / token refresh.
  const initializedRef = useRef(new Set())

  // ── Derive isAnonymous from Supabase user metadata ────────────────
  // Supabase sets is_anonymous = true on anonymous users.
  const isAnonymous = Boolean(user?.is_anonymous)

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

        // Seed demo data exactly once per new sign-in.
        // Skip for anonymous users — they get no demo docs.
        if (
          event === 'SIGNED_IN' &&
          s?.user &&
          !s.user.is_anonymous &&
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

  /** Email + password sign-in (no captcha required for sign-in) */
  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  /**
   * Email + password sign-up.
   * Email confirmation must be OFF in Supabase → Auth → Email → Confirm email.
   * With confirmation OFF, the user is returned immediately and can access the app.
   */
  const signUp = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    return data
  }

  /**
   * Google OAuth sign-in.
   * Redirects the browser to Google, then back to /dashboard.
   * No captcha required — OAuth flow handles bot protection itself.
   */
  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getOAuthRedirectUrl(),
      },
    })
    if (error) throw error
  }

  /**
   * Anonymous sign-in using Supabase's built-in anonymous auth.
   * Requires: Supabase Dashboard → Auth → Anonymous sign-ins → ON
   */
  const signInAnonymously = async () => {
    const { data, error } = await supabase.auth.signInAnonymously()
    if (error) throw error
    return data
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  const value = {
    user,
    session,
    loading,
    isAnonymous,
    signIn,
    signUp,
    signInWithGoogle,
    signInAnonymously,
    signOut,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export { AuthContext }
