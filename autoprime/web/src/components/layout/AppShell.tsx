'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DesktopSidebar, NavLinks, navItemsForRole } from './DesktopSidebar';
import { MobileHeader } from './MobileHeader';
import { MobileBottomNavigation } from './MobileBottomNavigation';
import { Topbar } from './Topbar';
import { ThemeToggle } from './ThemeToggle';
import { Drawer } from '@/components/ui/Drawer';
import { clearSession, getCurrentUser } from '@/lib/auth';
import { useCompany } from '@/lib/company-context';
import { AuthUser } from '@/lib/types';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { company } = useCompany();
  const router = useRouter();

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  function logout() {
    clearSession();
    router.push('/login');
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <DesktopSidebar role={user?.role ?? null} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <MobileHeader
          companyName={company?.name}
          user={user}
          onMenuClick={() => setDrawerOpen(true)}
        />
        <Topbar user={user} />

        <main className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 pb-24 lg:pb-6">
          {children}
        </main>

        <MobileBottomNavigation role={user?.role ?? null} onMore={() => setDrawerOpen(true)} />
      </div>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={company?.name ?? 'AP Auto Prime'}>
        <div className="px-3 py-4 flex flex-col gap-4 h-full">
          <NavLinks items={navItemsForRole(user?.role ?? null)} onNavigate={() => setDrawerOpen(false)} />
          <div className="mt-auto flex items-center justify-between px-3 py-2 border-t border-black/5 dark:border-white/10">
            <ThemeToggle />
            <button
              onClick={logout}
              className="text-sm font-medium text-danger hover:underline"
            >
              Sair
            </button>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
