import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Zap, Mail, Lock, ArrowRight, Loader2, Ghost } from 'lucide-react'
import { useAuth } from '../contexts/useAuth'

// ── Google icon ───────────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
    </svg>
  )
}

// ── Error extraction ──────────────────────────────────────────────────────────
function extractAuthError(err, fallback = 'Login failed. Please try again.') {
  if (import.meta.env.DEV) console.error('[Auron] auth error:', err)

  const raw =
    (err?.message && String(err.message).trim()) ||
    (err?.error_description && String(err.error_description).trim()) ||
    (err?.msg && String(err.msg).trim()) ||
    ''

  if (!raw || raw === '[object Object]') return fallback

  const lower = raw.toLowerCase()
  if (lower.includes('invalid login credentials') || lower.includes('invalid email or password'))
    return 'Invalid email or password. Please check your credentials and try again.'
  if (lower.includes('email not confirmed') || lower.includes('not confirmed'))
    return 'Email not confirmed. Please check your inbox.'
  if (lower.includes('rate limit') || lower.includes('too many requests'))
    return 'Too many requests. Please wait a few minutes and try again.'
  if (lower.includes('unable to validate email address') || lower.includes('invalid email'))
    return 'Please enter a valid email address.'
  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('network request failed'))
    return 'Network error. Please check your connection and try again.'

  return raw
}

// ── Shared outline button style ───────────────────────────────────────────────
const btnOutline =
  'w-full flex items-center justify-center gap-2.5 px-5 py-2.5 rounded-xl ' +
  'border border-white/[0.10] bg-white/[0.03] text-white text-sm font-medium ' +
  'hover:bg-white/[0.07] hover:border-white/20 transition-all ' +
  'disabled:opacity-60 disabled:cursor-not-allowed'

function OrDivider() {
  return (
    <div className="flex items-center gap-3 my-5">
      <div className="flex-1 h-px bg-white/[0.07]" />
      <span className="text-xs text-neutral-600 font-medium uppercase tracking-widest">or</span>
      <div className="flex-1 h-px bg-white/[0.07]" />
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Login() {
  const navigate = useNavigate()
  const { signIn, signInWithGoogle, signInAnonymously } = useAuth()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')

  const [loading, setLoading]             = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [anonLoading, setAnonLoading]     = useState(false)

  const anyLoading = loading || googleLoading || anonLoading

  // ── Email + password sign-in ──────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(extractAuthError(err))
    } finally {
      setLoading(false)
    }
  }

  // ── Google OAuth ──────────────────────────────────────────────────
  const handleGoogle = async () => {
    setError('')
    setGoogleLoading(true)
    try {
      await signInWithGoogle()
      // signInWithGoogle triggers a browser redirect — execution stops here.
    } catch (err) {
      setError(extractAuthError(err, 'Google sign-in failed. Please try again.'))
      setGoogleLoading(false)
    }
  }

  // ── Anonymous sign-in ─────────────────────────────────────────────
  const handleAnonymous = async () => {
    setError('')
    setAnonLoading(true)
    try {
      await signInAnonymously()
      navigate('/dashboard')
    } catch (err) {
      setError(extractAuthError(err, 'Unable to continue anonymously. Please try again.'))
      setAnonLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center px-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-indigo-500/5 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-white/20 to-white/5 border border-white/15 flex items-center justify-center shadow-lg">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-base tracking-tight text-white">
            Auron <span className="text-white/40">· Vehicle AI</span>
          </span>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl p-8 shadow-2xl">
          <h1 className="text-2xl font-bold text-white mb-1">Welcome back</h1>
          <p className="text-sm text-neutral-500 mb-7">Sign in to your Auron account</p>

          {/* Error banner */}
          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* ── Email + Password ──────────────────────────────────── */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-400 uppercase tracking-widest">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-neutral-600 text-sm focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.06] transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-400 uppercase tracking-widest">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-neutral-600 text-sm focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.06] transition-all"
                />
              </div>
            </div>

            {/* Sign In */}
            <button
              id="login-submit-btn"
              type="submit"
              disabled={anyLoading}
              className="w-full mt-2 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl btn-gradient text-sm font-semibold shadow-lg shadow-indigo-500/20 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Signing in…</span></>
                : <><span>Sign In</span><ArrowRight className="w-4 h-4" /></>
              }
            </button>
          </form>

          <OrDivider />

          {/* ── Google OAuth ──────────────────────────────────────── */}
          <button
            id="login-google-btn"
            type="button"
            onClick={handleGoogle}
            disabled={anyLoading}
            className={btnOutline}
          >
            {googleLoading
              ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Signing in with Google…</span></>
              : <><GoogleIcon /><span>Continue with Google</span></>
            }
          </button>

          {/* ── Anonymous ─────────────────────────────────────────── */}
          <button
            id="login-anon-btn"
            type="button"
            onClick={handleAnonymous}
            disabled={anyLoading}
            className={`${btnOutline} mt-3`}
          >
            {anonLoading
              ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Entering anonymously…</span></>
              : <><Ghost className="w-4 h-4 text-neutral-400" /><span className="text-neutral-300">Stay Anonymous</span></>
            }
          </button>

          <p className="mt-6 text-center text-sm text-neutral-600">
            Don&apos;t have an account?{' '}
            <Link
              to="/signup"
              className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
