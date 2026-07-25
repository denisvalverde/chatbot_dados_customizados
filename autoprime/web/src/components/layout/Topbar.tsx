'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ThemeToggle } from './ThemeToggle';
import { clearSession, roleLabel } from '@/lib/auth';
import { AuthUser } from '@/lib/types';

export function Topbar({ user }: { user: AuthUser | null }) {
  const router = useRouter();

  function logout() {
    clearSession();
    router.push('/login');
  }

  return (
    <header className="hidden lg:flex items-center justify-between border-b border-black/5 dark:border-white/10 bg-white/70 dark:bg-graphite-900/70 backdrop-blur-xl px-6 py-4">
      <div />
      <div className="flex items-center gap-4">
        <ThemeToggle />
        {user && (
          <div className="flex items-center gap-3">
            <Link href="/perfil" className="text-right hover:opacity-80 transition-opacity">
              <div className="text-sm font-medium text-graphite-900 dark:text-white">{user.email}</div>
              <div className="text-xs text-graphite-400 dark:text-white/40">{roleLabel(user.role)}</div>
            </Link>
            <Link
              href="/perfil"
              className="h-9 w-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-700 flex items-center justify-center text-white text-sm font-semibold"
            >
              {user.email[0]?.toUpperCase()}
            </Link>
            <button
              onClick={logout}
              className="text-xs font-medium text-graphite-400 hover:text-danger transition-colors ml-2"
            >
              Sair
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
