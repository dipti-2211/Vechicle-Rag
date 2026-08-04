import { Routes, Route, Navigate } from 'react-router-dom'

/**
 * Main App Component
 *
 * Sets up routing for the application.
 * Routes will be populated in future milestones:
 * - /login, /signup → Auth pages (Milestone 2)
 * - /dashboard → Dashboard (Milestone 7)
 * - /documents → Document management (Milestone 4)
 * - /chat → Chat interface (Milestone 5)
 */
function App() {
  return (
    <Routes>
      {/* Placeholder landing page — will be replaced in Milestone 2 */}
      <Route path="/" element={<LandingPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

/**
 * Temporary Landing Page
 *
 * Verifies that the frontend scaffolding works correctly.
 * Will be replaced by proper auth/dashboard flow in Milestone 2.
 */
function LandingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-950 via-surface-900 to-primary-900">
      <div className="text-center animate-fade-in">
        {/* Logo / Icon */}
        <div className="mb-8 flex justify-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-2xl shadow-primary-500/30">
            <svg
              className="w-10 h-10 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611l-.573.097a9.59 9.59 0 0 1-3.124 0l-.573-.097c-1.717-.293-2.3-2.379-1.067-3.61L16.2 15.3M5 14.5l-1.402 1.402c-1.232 1.232-.65 3.318 1.067 3.611l.573.097a9.59 9.59 0 0 0 3.124 0l.573-.097c1.717-.293 2.3-2.379 1.067-3.61L8.6 14.5"
              />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
          Vehicle Maintenance
          <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-accent-400">
            RAG Assistant
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-surface-400 text-lg md:text-xl max-w-md mx-auto mb-10 leading-relaxed">
          AI-powered document search for vehicle maintenance — upload docs, ask questions, get precise answers.
        </p>

        {/* Status Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-500/10 border border-accent-500/20">
          <span className="w-2 h-2 rounded-full bg-accent-500 animate-pulse-soft"></span>
          <span className="text-accent-400 text-sm font-medium">
            System Online — Milestone 1 Complete
          </span>
        </div>

        {/* Tech Stack */}
        <div className="mt-12 flex flex-wrap justify-center gap-3">
          {['React', 'FastAPI', 'Gemini', 'ChromaDB', 'Supabase'].map((tech) => (
            <span
              key={tech}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-surface-400 bg-surface-800/50 border border-surface-700/50 backdrop-blur-sm"
            >
              {tech}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export default App
