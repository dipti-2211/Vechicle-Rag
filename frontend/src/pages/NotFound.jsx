import { useNavigate } from 'react-router-dom';
import { Home, Zap } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 bg-surface-950"
         style={{
           backgroundImage:
             'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99,102,241,0.15) 0%, transparent 60%)',
         }}
    >
      <div className="w-24 h-24 rounded-3xl btn-gradient flex items-center justify-center mb-8 shadow-2xl shadow-primary-500/40">
        <Zap className="w-12 h-12 text-white" />
      </div>
      <h1 className="text-8xl font-black gradient-text mb-4">404</h1>
      <h2 className="text-2xl font-bold text-white mb-3">Page Not Found</h2>
      <p className="text-surface-400 max-w-md mb-8 text-sm leading-relaxed">
        This page doesn't exist in the Vehicle Intelligence system. It may have been moved or the URL is incorrect.
      </p>
      <button
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-2 px-6 py-3 rounded-2xl btn-gradient text-sm font-semibold shadow-lg shadow-primary-500/30"
      >
        <Home className="w-4 h-4" />
        Back to Dashboard
      </button>
    </div>
  );
}
