/**
 * AuthContext — Supabase Auth state for the entire app.
 *
 * Exposes:
 *   user              — Supabase User object (or null)
 *   session           — Supabase Session object (or null)
 *   loading           — true while initial session is being resolved
 *   isAnonymous       — true if the current user is anonymous
 *   signIn            — email + password sign-in
 *   signUp            — email + password sign-up
 *   signInWithGoogle  — Google OAuth (redirects)
 *   signInAnonymously — always creates a fresh anonymous session
 *   signOut
 *
 * ═══════════════════════════════════════════════════════════════
 * ANONYMOUS ISOLATION DESIGN
 * ═══════════════════════════════════════════════════════════════
 * Supabase persists every session — including anonymous ones — in
 * localStorage. Without intervention, refreshing the page restores
 * the SAME anonymous user_id, so all their old data reappears.
 *
 * Fix — on every app start, if a persisted anonymous session is
 * detected we:
 *   1. Sign out the old anonymous session (scope:'local' — no network
 *      call, just clears localStorage).
 *   2. Immediately call signInAnonymously() to get a brand-new UID.
 *   3. Set the new session as the current auth state.
 *
 * Result:
 *   REFRESH      → old UID gone, new UID, empty workspace
 *   CLOSE+REOPEN → old UID gone, new UID, empty workspace
 *   USER B       → different UID, completely isolated workspace
 *
 * Permanent (email / Google) sessions ARE restored normally.
 * Their data persists across refreshes as expected.
 * ═══════════════════════════════════════════════════════════════
 */

import {
  createContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { supabase } from '../lib/supabase'
import api from '../api/axios'

const AuthContext = createContext(null)

// ── OAuth redirect URL ────────────────────────────────────────────────────────
// VITE_SITE_URL is set on Render to the exact production frontend URL.
// In local dev it falls back to window.location.origin.
function getOAuthRedirectUrl() {
  const base =
    (import.meta.env.VITE_SITE_URL || '').replace(/\/$/, '') ||
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173')
  return `${base}/dashboard`
}

// ── Helper: is this Supabase user anonymous? ──────────────────────────────────
function isAnonUser(user) {
  return Boolean(user?.is_anonymous)
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [session, setSession] = useState(null)
  // Start true — we resolve the session before rendering anything.
  const [loading, setLoading] = useState(true)

  // Track which user IDs have already had demo data seeded this browser session.
  const initializedRef = useRef(new Set())
  // Prevent the onAuthStateChange listener from reacting to our own
  // sign-out → sign-in sequence during anonymous refresh.
  const refreshingAnonRef = useRef(false)

  // ── Derived ───────────────────────────────────────────────────────────────
  const isAnonymous = isAnonUser(user)

  // ── Demo-data seeding (permanent accounts only) ───────────────────────────
  const initializeUser = async (accessToken) => {
    // Guard: never fire the request if there's no valid token — would return 401.
    if (!accessToken) {
      console.warn('[Auron] initializeUser skipped: no access token available.')
      return
    }
    // Safe debug — never log the actual token value.
    console.debug('[Auron] initializeUser: session exists: true | access token exists:', !!accessToken)
    try {
      await api.post(
        '/api/auth/initialize-user',
        {},
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      console.debug('[Auron] initializeUser: request completed successfully')
    } catch (err) {
      console.warn('[Auron] User initialization failed:', err?.response?.data ?? err.message)
    }
  }


  // ── Create a brand-new anonymous session ──────────────────────────────────
  // Shared by both the startup auto-refresh and the manual "Stay Anonymous" click.
  const _createFreshAnonSession = async () => {
    // Clear the old session from localStorage (no server round-trip needed)
    await supabase.auth.signOut({ scope: 'local' })
    // Obtain a brand-new anonymous UID from Supabase
    const { data, error } = await supabase.auth.signInAnonymously()
    if (error) throw error
    return data
  }

  // ── Startup: resolve initial session ─────────────────────────────────────
  useEffect(() => {
    let didMount = true

    async function resolveInitialSession() {
      try {
        const { data: { session: s } } = await supabase.auth.getSession()

        if (!didMount) return

        if (s?.user && isAnonUser(s.user)) {
          // ─────────────────────────────────────────────────────────────────
          // Persisted anonymous session found.
          // Replace it with a fresh one so the user always starts clean.
          // We mark refreshingAnonRef so the onAuthStateChange listener
          // ignores intermediate SIGNED_OUT events from our own sign-out.
          // ─────────────────────────────────────────────────────────────────
          console.debug('[Auron] Startup: persisted anonymous session detected — refreshing to new UID.')
          refreshingAnonRef.current = true
          try {
            const freshData = await _createFreshAnonSession()
            if (didMount) {
              setSession(freshData.session)
              setUser(freshData.user)
            }
          } catch (err) {
            console.warn('[Auron] Could not create fresh anonymous session:', err)
            // Fallback: leave the user as logged-out
            if (didMount) {
              setSession(null)
              setUser(null)
            }
          } finally {
            refreshingAnonRef.current = false
          }

        } else {
          // Permanent (email / Google) session — restore normally.
          if (didMount) {
            setSession(s)
            setUser(s?.user ?? null)
          }
        }
      } catch (err) {
        console.warn('[Auron] Session resolution error:', err)
        if (didMount) {
          setSession(null)
          setUser(null)
        }
      } finally {
        if (didMount) setLoading(false)
      }
    }

    resolveInitialSession()

    // ── Listen for subsequent auth state changes ──────────────────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        if (!didMount) return

        // Ignore events fired by our own anonymous-refresh sequence.
        if (refreshingAnonRef.current) return

        if (event === 'SIGNED_OUT') {
          setSession(null)
          setUser(null)
          setLoading(false)
          return
        }

        setSession(s)
        setUser(s?.user ?? null)
        setLoading(false)

        // Seed demo data exactly once per new permanent user sign-in.
        if (
          event === 'SIGNED_IN' &&
          s?.user &&
          !isAnonUser(s.user) &&
          !initializedRef.current.has(s.user.id)
        ) {
          console.debug(
            '[Auron] onAuthStateChange SIGNED_IN:',
            'user exists:', !!s.user,
            '| is anonymous:', isAnonUser(s.user),
            '| access token exists:', !!s.access_token,
          )
          initializedRef.current.add(s.user.id)
          await initializeUser(s.access_token)
        }
      }
    )

    return () => {
      didMount = false
      subscription.unsubscribe()
    }
  }, [])

  // ── Auth actions ──────────────────────────────────────────────────────────

  /** Email + password sign-in */
  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  /**
   * Email + password sign-up.
   * "Confirm email" must be OFF in Supabase → Auth → Email for immediate access.
   */
  const signUp = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    return data
  }

  /**
   * Google OAuth sign-in.
   * Redirects the browser to Google → back to /dashboard.
   * VITE_SITE_URL on Render must match the Supabase redirect URL allowlist.
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
   * Anonymous sign-in — ALWAYS creates a brand-new isolated session.
   *
   * Regardless of whether there is an existing session (anonymous or
   * permanent), this action discards it and creates a fresh anonymous UID.
   * Each click of "Stay Anonymous" = completely new workspace.
   */
  const signInAnonymously = async () => {
    refreshingAnonRef.current = true
    try {
      const freshData = await _createFreshAnonSession()
      setSession(freshData.session)
      setUser(freshData.user)
      return freshData
    } finally {
      refreshingAnonRef.current = false
    }
  }

  const signOut = async () => {
    // Always clear local state first so the UI responds immediately.
    // Server-side session invalidation may fail (e.g. 403 for an already-expired
    // anonymous session) — that's non-fatal; the local token is discarded regardless.
    setSession(null)
    setUser(null)
    try {
      await supabase.auth.signOut()
    } catch (err) {
      // Non-fatal — local state is already cleared above
      console.warn('[Auron] Server-side signOut error (non-fatal):', err?.message ?? err)
    }
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
