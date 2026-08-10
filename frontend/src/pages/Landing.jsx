import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, MessageSquare, FileText, UploadCloud, Settings, Zap, ArrowRight } from 'lucide-react';
import { IlluminatedHero } from '../components/ui/illuminated-hero';

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard',  icon: LayoutDashboard },
  { path: '/chat',      label: 'Chat',        icon: MessageSquare },
  { path: '/documents', label: 'Documents',  icon: FileText },
  { path: '/upload',    label: 'Upload',      icon: UploadCloud },
  { path: '/settings',  label: 'Settings',    icon: Settings },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="relative">
      {/* Fixed top brand bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-6 bg-black/60 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl btn-gradient flex items-center justify-center shadow-lg shadow-primary-500/30">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-sm tracking-tight hidden sm:block text-white">
            <span className="gradient-text">Auron</span>
            <span className="text-white/70"> · Vehicle AI Assistant</span>
          </span>
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition-all duration-200"
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>

        <button
          onClick={() => navigate('/chat')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl btn-gradient text-sm font-semibold text-white shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40 transition-all"
        >
          <MessageSquare className="w-4 h-4" />
          <span className="hidden sm:inline">Ask AI</span>
          <ArrowRight className="w-4 h-4 sm:hidden" />
        </button>
      </div>

      {/* Hero section */}
      <IlluminatedHero
        title="Introducing"
        highlightText="Auron"
        subtitle="The Vehicle AI Assistant."
        description="Experience intelligent vehicle diagnostics, document search, and real-time operational insights — all powered by Gemini AI."
      >
        {/* nav buttons rendered inside the hero via children slot */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/20 bg-white/5 hover:bg-white/15 text-white text-sm font-medium backdrop-blur-sm transition-all duration-200 hover:border-white/40 hover:scale-105"
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </IlluminatedHero>

      {/* Mobile bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 md:hidden bg-black/80 backdrop-blur-md border-t border-white/10 z-50">
        <div className="flex items-center justify-around h-14 px-2">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl text-white/50 hover:text-white transition-all"
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
