import axios from 'axios'

/**
 * Pre-configured Axios instance for API calls.
 *
 * In development, Vite's proxy forwards /api/* requests to the backend.
 * In production, VITE_API_URL points directly to the deployed backend.
 *
 * The request interceptor automatically attaches the Supabase JWT
 * from localStorage for authenticated requests.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout
})

// ── Request Interceptor: Attach Auth Token ──────────────────────────
api.interceptors.request.use(
  (config) => {
    // Supabase stores the session in localStorage
    const storageKey = `sb-${import.meta.env.VITE_SUPABASE_URL?.split('//')[1]?.split('.')[0]}-auth-token`
    const session = localStorage.getItem(storageKey)

    if (session) {
      try {
        const parsed = JSON.parse(session)
        const token = parsed?.access_token
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
      } catch {
        // Invalid session data, continue without auth
      }
    }

    return config
  },
  (error) => Promise.reject(error)
)

// ── Response Interceptor: Handle Common Errors ──────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid — redirect to login
      // This will be enhanced in Milestone 2
      console.warn('Unauthorized — session may have expired')
    }

    return Promise.reject(error)
  }
)

export default api
