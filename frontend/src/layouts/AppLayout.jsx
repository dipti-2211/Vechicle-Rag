import { Outlet, useLocation } from 'react-router-dom';
import { TopNav } from '../components/layout/TopNav';
import { HistoryDrawer } from '../components/layout/HistoryDrawer';

/**
 * AppLayout — wraps every page with:
 *   - Fixed glassmorphism TopNav
 *   - Full-width scrollable main content
 *   - Floating HistoryDrawer (bottom-left)
 */
export function AppLayout() {
  const location = useLocation();
  // The Chat page handles its own layout (full-height flex)
  const isChatPage = location.pathname === '/chat';

  return (
    <div className="min-h-screen transition-colors duration-300">
      {/* Fixed top navigation bar */}
      <TopNav />

      {/* Main content — offset by the nav height (64px) */}
      <main
        className={`${
          isChatPage
            ? 'h-screen pt-16 overflow-hidden'
            : 'min-h-screen pt-16 pb-16 md:pb-0'
        }`}
      >
        {isChatPage ? (
          <Outlet />
        ) : (
          <div className="h-full px-4 md:px-6 py-6 max-w-7xl mx-auto w-full animate-fade-in">
            <Outlet />
          </div>
        )}
      </main>

      {/* Floating history drawer — appears on all pages */}
      <HistoryDrawer />
    </div>
  );
}
