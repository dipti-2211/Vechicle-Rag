import axios from 'axios'

/**
 * Pre-configured Axios instance for API calls.
 *
 * In development, Vite's proxy forwards /api/* requests to the backend.
 * In production, VITE_API_URL points directly to the deployed backend.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout
})

// ── Response Interceptor: Handle Common Errors ──────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // You can handle global errors here (e.g., showing toast for 500 errors)
    return Promise.reject(error)
  }
)

export default api
