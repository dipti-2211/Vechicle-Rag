import axios from 'axios'
import { supabase } from '../lib/supabase'

/**
 * Determine the API base URL at runtime.
 *
 * Priority order:
 *   1. VITE_API_URL environment variable (set at build time by Render)
 *   2. Runtime detection: localhost → local backend, any other host → production
 *
 * This ensures the app works correctly in BOTH environments:
 *   - Local dev (localhost:5173) → http://localhost:8000
 *   - Production (auron-frontend.onrender.com) → https://auron-backend-un4f.onrender.com
 *
 * NOTE: We do NOT set a global Content-Type header here.
 * - For JSON requests, axios automatically sets 'application/json'.
 * - For file uploads (FormData), the browser must set 'multipart/form-data'
 *   WITH the correct boundary — setting it manually breaks the upload.
 */
const PRODUCTION_BACKEND = 'https://auron-backend-un4f.onrender.com'

function getApiBaseUrl() {
  // 1. Build-time env var (set by Render or .env) — highest priority
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }
  // 2. Runtime detection — localhost = local dev, anything else = production
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') {
      return 'http://localhost:8000'
    }
    return PRODUCTION_BACKEND
  }
  return ''
}

export const API_BASE_URL = getApiBaseUrl()

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000, // 120 second timeout (large file uploads need more time)
})

// ── Request Interceptor: Attach Supabase JWT ────────────────────────
// Reads the current session from Supabase and injects
// Authorization: Bearer <access_token> into every request.
// The backend verifies this token to identify the current user.
api.interceptors.request.use(async (config) => {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      config.headers['Authorization'] = `Bearer ${session.access_token}`
    }
  } catch {
    // Session unavailable — request proceeds without auth header
  }
  return config
})

// ── Response Interceptor: Handle Common Errors ──────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Extract a human-readable error message from common response shapes
    if (error.response?.data) {
      const data = error.response.data
      // FastAPI validation errors come as { detail: [...] }
      if (Array.isArray(data.detail)) {
        error.message = data.detail.map((d) => d.msg).join(', ')
      } else if (typeof data.detail === 'string') {
        error.message = data.detail
      }
    }
    return Promise.reject(error)
  }
)

export default api
