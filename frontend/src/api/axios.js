import axios from 'axios'

/**
 * Pre-configured Axios instance for API calls.
 *
 * In development, Vite's proxy forwards /api/* requests to the backend.
 * In production, VITE_API_URL points directly to the deployed backend.
 *
 * NOTE: We do NOT set a global Content-Type header here.
 * - For JSON requests, axios automatically sets 'application/json'.
 * - For file uploads (FormData), the browser must set 'multipart/form-data'
 *   WITH the correct boundary — setting it manually breaks the upload.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 120000, // 120 second timeout (large file uploads need more time)
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
