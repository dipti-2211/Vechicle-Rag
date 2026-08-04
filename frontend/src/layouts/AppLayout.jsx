import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Sidebar } from '../components/layout/Sidebar';

export function AppLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 flex transition-colors duration-300">
      {/* Sidebar Component */}
      <Sidebar mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64 transition-all duration-300">
        
        {/* Mobile Header */}
        <header className="lg:hidden h-16 flex items-center px-4 border-b border-surface-200 dark:border-surface-800 bg-surface-50/80 dark:bg-surface-900/80 backdrop-blur-md sticky top-0 z-30">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 -ml-2 rounded-md text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-800 focus:outline-none"
          >
            <Menu className="w-6 h-6" />
          </button>
          <span className="ml-3 font-semibold text-surface-900 dark:text-surface-100">
            Vehicle Intelligence
          </span>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <div className="h-full p-4 md:p-6 max-w-7xl mx-auto w-full animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
