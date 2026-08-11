import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home, LayoutDashboard, MessageSquare,
  FileText, UploadCloud, Settings, Sun, Moon, Zap,
} from 'lucide-react';
import { useTheme } from '../../contexts/useTheme';
import { LimelightNav } from '../ui/limelight-nav';

const NAV_ITEMS = [
  { id: 'home',      path: '/',          label: 'Home',      icon: Home            },
  { id: 'dashboard', path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'chat',      path: '/chat',      label: 'Chat',       icon: MessageSquare  },
  { id: 'documents', path: '/documents', label: 'Documents',  icon: FileText       },
  { id: 'upload',    path: '/upload',    label: 'Upload',     icon: UploadCloud    },
  { id: 'settings',  path: '/settings',  label: 'Settings',   icon: Settings       },
];

export function TopNav() {
  const { theme, toggleTheme } = useTheme();
  const navigate  = useNavigate();
  const location  = useLocation();

  // Derive which tab is active from the current URL
  const activeIndex = NAV_ITEMS.findIndex((item) => {
    if (item.path === '/') return location.pathname === '/';
    return location.pathname.startsWith(item.path);
  });

  // Build LimelightNav items
  const navItems = NAV_ITEMS.map(({ id, path, label, icon: Icon }) => ({
    id,
    label,
    icon: <Icon />,
    onClick: () => navigate(path),
  }));

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16">
      {/* Glass background */}
      <div className="h-full glass border-b border-white/10 dark:border-white/5">
        <div className="h-full max-w-screen-2xl mx-auto px-4 md:px-6 flex items-center justify-between gap-4">

          {/* Brand — clicking navigates home */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2.5 flex-shrink-0 group"
          >
            <div className="w-8 h-8 rounded-xl btn-gradient flex items-center justify-center shadow-lg shadow-primary-500/30 group-hover:shadow-primary-500/50 transition-all">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-sm tracking-tight hidden sm:block">
              <span className="gradient-text">Auron</span>
              <span className="text-surface-700 dark:text-surface-300"> · Vehicle AI</span>
            </span>
          </button>

          {/* LimelightNav — centered desktop navigation */}
          <div className="absolute left-1/2 -translate-x-1/2 hidden md:block">
            <LimelightNav
              items={navItems}
              defaultActiveIndex={activeIndex >= 0 ? activeIndex : 0}
              className="border-white/10 dark:border-white/8"
            />
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl text-surface-500 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100 hover:bg-surface-100/60 dark:hover:bg-white/5 transition-all"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark'
                ? <Sun className="w-4 h-4" />
                : <Moon className="w-4 h-4" />
              }
            </button>

            {/* Chat CTA */}
            <button
              onClick={() => navigate('/chat')}
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl btn-gradient text-sm font-semibold shadow-lg shadow-primary-500/25"
            >
              <MessageSquare className="w-4 h-4" />
              Ask AI
            </button>
          </div>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 md:hidden glass border-t border-white/10 dark:border-white/5 z-50">
        <div className="flex items-center justify-around h-14 px-2">
          {NAV_ITEMS.map(({ id, path, label, icon: Icon }) => {
            const isActive = path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(path);
            return (
              <button
                key={id}
                onClick={() => navigate(path)}
                className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all ${
                  isActive
                    ? 'text-primary-500 dark:text-primary-400'
                    : 'text-surface-400 dark:text-surface-500'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
