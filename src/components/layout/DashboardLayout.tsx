'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Video,
  Music,
  FolderOpen,
  Clapperboard,
  Boxes,
  Palette,
  Users,
  LayoutTemplate,
  Settings,
  LogOut,
  Menu,
  X,
  Scissors,
} from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuthStore, useUIStore } from '@/lib/store';

interface DashboardLayoutProps {
  children: ReactNode;
}

const navSections: { title: string; items: { href: string; label: string; icon: typeof Video }[] }[] = [
  {
    title: 'Overview',
    items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    title: 'Library',
    items: [
      { href: '/dashboard/videos', label: 'Source Videos', icon: Video },
      { href: '/dashboard/music', label: 'Music', icon: Music },
      { href: '/dashboard/assets', label: 'Assets', icon: Boxes },
      { href: '/dashboard/brands', label: 'Brands', icon: Palette },
      { href: '/dashboard/personas', label: 'Personas', icon: Users },
    ],
  },
  {
    title: 'Create',
    items: [
      { href: '/dashboard/templates', label: 'Templates', icon: LayoutTemplate },
      { href: '/dashboard/projects', label: 'Projects', icon: FolderOpen },
      { href: '/dashboard/custom_video', label: 'Custom Videos', icon: Clapperboard },
    ],
  },
];

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5">
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-900/40">
        <Scissors className="h-[18px] w-[18px] text-white" strokeWidth={2.5} />
        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-[#0b0b0f]" />
      </span>
      <span className="text-[17px] font-semibold tracking-tight text-white">
        neural<span className="text-violet-400">Cut</span>
      </span>
    </Link>
  );
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, hasHydrated, logout } = useAuthStore();
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!isAuthenticated) router.replace('/auth/login');
  }, [hasHydrated, isAuthenticated, router]);

  const handleLogout = () => {
    logout();
    router.push('/auth/login');
  };

  if (!hasHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0d]">
        <Scissors className="h-7 w-7 animate-pulse text-violet-500" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href));

  const settingsActive = isActive('/dashboard/settings');

  return (
    <div className="min-h-screen bg-[#0a0a0d] text-slate-200">
      {/* Ambient backdrop */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-40 left-1/3 h-96 w-96 rounded-full bg-violet-600/10 blur-[120px]" />
        <div className="absolute bottom-0 right-10 h-80 w-80 rounded-full bg-indigo-600/10 blur-[120px]" />
      </div>

      <ConfirmDialog
        open={showLogoutConfirm}
        title="Sign out?"
        description="You will be signed out of your account and redirected to the login page."
        confirmLabel="Sign out"
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={() => {
          setShowLogoutConfirm(false);
          handleLogout();
        }}
      />

      {/* Mobile header */}
      <header className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-white/[0.06] bg-[#0a0a0d]/90 px-4 backdrop-blur-xl lg:hidden">
        <button onClick={toggleSidebar} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white">
          {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <Brand />
        <div className="w-10" />
      </header>

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-white/[0.06] bg-[#0b0b0f]/95 backdrop-blur-xl transition-transform duration-300 ease-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center border-b border-white/[0.06] px-5">
          <Brand />
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {navSections.map((section) => (
            <div key={section.title}>
              <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                {section.title}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => sidebarOpen && toggleSidebar()}
                      className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                        active ? 'bg-white/[0.06] text-white' : 'text-slate-400 hover:bg-white/[0.035] hover:text-white'
                      }`}
                    >
                      {active && <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-violet-400" />}
                      <Icon size={18} className={active ? 'text-violet-300' : 'text-slate-500 group-hover:text-slate-300'} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User + settings */}
        <div className="border-t border-white/[0.06] p-3">
          <Link
            href="/dashboard/settings"
            onClick={() => sidebarOpen && toggleSidebar()}
            className={`mb-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
              settingsActive ? 'bg-white/[0.06] text-white' : 'text-slate-400 hover:bg-white/[0.035] hover:text-white'
            }`}
          >
            <Settings size={18} className={settingsActive ? 'text-violet-300' : 'text-slate-500'} />
            Settings
          </Link>

          <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 text-sm font-semibold text-white">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{user?.email || 'User'}</p>
              <p className="text-xs text-slate-500">Free plan</p>
            </div>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-red-400"
              aria-label="Sign out"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="relative z-10 min-h-screen pt-16 transition-all duration-300 lg:pl-64 lg:pt-0">
        <div className="mx-auto max-w-7xl p-5 sm:p-7 lg:p-9">{children}</div>
      </main>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden" onClick={toggleSidebar} />
      )}
    </div>
  );
}
