import { useNavigate } from 'react-router-dom';
import { MessageSquare, UploadCloud, Zap } from 'lucide-react';
import { LimelightNav }  from '../components/ui/limelight-nav';
import { SplineScene }   from '../components/ui/splite';
import { Spotlight }     from '../components/ui/spotlight';
import { Card }          from '../components/ui/card';
import {
  Home, LayoutDashboard, MessageSquare as ChatIcon,
  FileText, UploadCloud as Upload, Settings,
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'home',      path: '/',          label: 'Home',      icon: Home           },
  { id: 'dashboard', path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'chat',      path: '/chat',      label: 'Chat',       icon: ChatIcon       },
  { id: 'documents', path: '/documents', label: 'Documents',  icon: FileText       },
  { id: 'upload',    path: '/upload',    label: 'Upload',     icon: Upload         },
  { id: 'settings',  path: '/settings',  label: 'Settings',   icon: Settings       },
];

export default function Landing() {
  const navigate = useNavigate();

  const navItems = NAV_ITEMS.map(({ id, path, label, icon: Icon }) => ({
    id,
    label,
    icon: <Icon />,
    onClick: () => navigate(path),
  }));

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden flex flex-col">

      {/* ── Top Bar ─────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 h-16 flex items-center justify-between px-6 bg-black/60 backdrop-blur-md border-b border-white/8 z-50">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-white/20 to-white/5 border border-white/15 flex items-center justify-center shadow-lg">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-sm tracking-tight text-white hidden sm:block">
            Auron <span className="text-white/40">· Vehicle AI</span>
          </span>
        </div>

        {/* LimelightNav — centered, Home active by default */}
        <div className="absolute left-1/2 -translate-x-1/2">
          <LimelightNav
            items={navItems}
            defaultActiveIndex={0}
          />
        </div>

        {/* CTA button */}
        <button
          onClick={() => navigate('/chat')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black text-sm font-semibold shadow-lg hover:bg-white/90 transition-all duration-200 hover:scale-[1.02]"
        >
          <MessageSquare className="w-4 h-4" />
          <span className="hidden sm:inline">Ask AI</span>
        </button>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <main className="flex-1 relative overflow-hidden">
        <Card className="w-full h-full bg-black border-0 rounded-none relative overflow-hidden">

          {/* Spotlight hover effect */}
          <Spotlight size={400} />

          {/* Subtle grid overlay */}
          <div
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }}
          />

          <div className="relative z-10 flex flex-col lg:flex-row h-full">

            {/* ── Left: Text Content ─────────────────────────────────── */}
            <div className="flex-1 flex flex-col justify-center px-8 md:px-16 lg:px-20 pt-8 lg:pt-0 max-w-xl">

              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/15 bg-white/5 backdrop-blur-sm mb-6 w-fit">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-white/60 font-medium">Powered by Gemini AI</span>
              </div>

              {/* Headline */}
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight">
                <span className="text-white/30 block text-2xl md:text-3xl font-semibold mb-1">The Vehicle's AI</span>
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage: 'linear-gradient(135deg, #ffffff 0%, #a0a0a0 60%, #505050 100%)',
                  }}
                >
                  Auron
                </span>
              </h1>

              {/* Subtitle */}
              <p className="mt-5 text-white/50 text-sm md:text-base leading-relaxed max-w-sm">
                Upload vehicle manuals, ask questions in natural language, and get
                instant AI-powered answers — from maintenance intervals to safety specs.
              </p>

              {/* Primary CTAs only — no duplicate pill buttons */}
              <div className="mt-8 flex items-center gap-3">
                <button
                  onClick={() => navigate('/chat')}
                  className="flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-white text-black text-sm font-bold shadow-[0_0_40px_rgba(255,255,255,0.15)] hover:shadow-[0_0_60px_rgba(255,255,255,0.25)] hover:bg-white/95 transition-all duration-300 hover:scale-[1.03]"
                >
                  <MessageSquare className="w-4 h-4" />
                  Start Chatting
                </button>
                <button
                  onClick={() => navigate('/upload')}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl border border-white/20 bg-white/5 hover:bg-white/10 text-white text-sm font-semibold backdrop-blur-sm transition-all duration-200 hover:scale-[1.02]"
                >
                  <UploadCloud className="w-4 h-4" />
                  Upload Docs
                </button>
              </div>
            </div>

            {/* ── Right: Spline 3D Animation ─────────────────────────── */}
            <div className="flex-1 relative min-h-[300px] lg:min-h-0">
              {/* Fade gradient on the left edge */}
              <div className="absolute left-0 inset-y-0 w-32 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none" />
              <SplineScene
                scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
                className="w-full h-full"
              />
            </div>
          </div>
        </Card>
      </main>

      {/* ── Mobile bottom nav ───────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 lg:hidden bg-black/90 backdrop-blur-md border-t border-white/8 z-50">
        <div className="flex items-center justify-around h-14 px-2">
          {NAV_ITEMS.map(({ id, path, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => navigate(path)}
              className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl text-white/40 hover:text-white transition-all"
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
