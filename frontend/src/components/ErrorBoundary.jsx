import { Component } from 'react';

/**
 * React Error Boundary
 *
 * Catches unhandled JavaScript errors anywhere in the component tree
 * and displays a friendly fallback UI instead of a blank white screen.
 *
 * Must be a class component — hooks cannot be used for error boundaries.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log to console in development
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload() {
    window.location.reload();
  }

  handleReset() {
    this.setState({ hasError: false, error: null, errorInfo: null });
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const isDev = import.meta.env.DEV;

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        <div
          style={{
            maxWidth: '520px',
            width: '100%',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '1.5rem',
            padding: '2.5rem',
            backdropFilter: 'blur(12px)',
            textAlign: 'center',
          }}
        >
          {/* Icon */}
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>

          {/* Title */}
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: '#f1f5f9',
              margin: '0 0 0.75rem',
            }}
          >
            Something went wrong
          </h1>

          {/* Subtitle */}
          <p style={{ color: '#94a3b8', fontSize: '0.95rem', margin: '0 0 2rem', lineHeight: 1.6 }}>
            An unexpected error occurred. You can try reloading the page or
            navigating back to the dashboard.
          </p>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={this.handleReload}
              style={{
                padding: '0.6rem 1.4rem',
                borderRadius: '0.75rem',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: '#fff',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              🔄 Reload Page
            </button>
            <button
              onClick={() => { window.location.href = '/'; }}
              style={{
                padding: '0.6rem 1.4rem',
                borderRadius: '0.75rem',
                background: 'rgba(255,255,255,0.08)',
                color: '#cbd5e1',
                border: '1px solid rgba(255,255,255,0.15)',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              🏠 Go to Dashboard
            </button>
          </div>

          {/* Error details (dev only) */}
          {isDev && this.state.error && (
            <details
              style={{
                marginTop: '2rem',
                textAlign: 'left',
                background: 'rgba(0,0,0,0.3)',
                borderRadius: '0.75rem',
                padding: '1rem',
                border: '1px solid rgba(239,68,68,0.3)',
              }}
            >
              <summary
                style={{ color: '#f87171', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
              >
                🐛 Error Details (dev only)
              </summary>
              <pre
                style={{
                  marginTop: '0.75rem',
                  fontSize: '0.75rem',
                  color: '#fca5a5',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  lineHeight: 1.5,
                }}
              >
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}
