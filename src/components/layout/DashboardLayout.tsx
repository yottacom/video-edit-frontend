'use client';

import { ReactNode, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Video, 
  Music, 
  FolderOpen, 
  Settings, 
  LogOut,
  Menu,
  X,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { useAuthStore, useUIStore } from '@/lib/store';

interface DashboardLayoutProps {
  children: ReactNode;
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Sparkles },
  { href: '/dashboard/videos', label: 'Source Videos', icon: Video },
  { href: '/dashboard/music', label: 'Music Library', icon: Music },
  { href: '/dashboard/projects', label: 'Projects', icon: FolderOpen },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();
  const { sidebarOpen, toggleSidebar } = useUIStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login');
    }
  }, [isAuthenticated, router]);

  const handleLogout = () => {
    logout();
    router.push('/auth/login');
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800">
        <div className="flex items-center justify-between px-4 h-16">
          <button onClick={toggleSidebar} className="p-2 text-slate-400 hover:text-white">
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-violet-500" />
            <span className="font-bold text-white">Video Editor</span>
          </div>
          <div className="w-10" />
        </div>
      </header>

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-40 h-screen w-64 
        bg-slate-900/95 backdrop-blur-sm border-r border-slate-800
        transform transition-transform duration-300 ease-out
        lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 h-16 border-b border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-white">Video Editor</h1>
            <p className="text-xs text-slate-500">AI-Powered</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-1 p-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== '/dashboard' && pathname.startsWith(item.href));
            const Icon = item.icon;
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg
                  transition-all duration-200
                  ${isActive 
                    ? 'bg-violet-600/20 text-violet-400 border border-violet-500/30' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'}
                `}
              >
                <Icon size={20} />
                <span className="font-medium">{item.label}</span>
                {isActive && <ChevronRight size={16} className="ml-auto" />}
              </Link>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-800/50">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
              <span className="text-white font-medium">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user?.email || 'User'}
              </p>
              <p className="text-xs text-slate-500">Free Plan</p>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-red-400 transition-colors"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="min-h-screen pt-16 lg:pt-0 lg:pl-64 transition-all duration-300">
        <div className="p-6 lg:p-8">
          {children}
        </div>
      </main>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 z-30 bg-black/50 backdrop-blur-sm"
          onClick={toggleSidebar}
        />
      )}
    </div>
  );
}
