import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider } from './contexts/AuthContext'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <App />
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  borderRadius: '14px',
                  padding: '12px 16px',
                  fontSize: '13px',
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: '500',
                  background: 'rgba(15, 23, 42, 0.9)',
                  color: '#f1f5f9',
                  border: '1px solid rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(16px)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                },
                success: {
                  iconTheme: { primary: '#10b981', secondary: 'rgba(15,23,42,0.9)' },
                },
                error: {
                  iconTheme: { primary: '#f87171', secondary: 'rgba(15,23,42,0.9)' },
                },
              }}
            />
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
)
