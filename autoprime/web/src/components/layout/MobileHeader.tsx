'use client';

import Link from 'next/link';
import { AuthUser } from '@/lib/types';

export function MobileHeader({
  companyName,
  user,
  onMenuClick,
}: {
  companyName?: string;
  user: AuthUser | null;
  onMenuClick: () => void;
}) {
  return (
    <header className="lg:hidden sticky top-0 z-30 pt-safe border-b border-black/5 dark:border-white/10 bg-white/80 dark:bg-graphite-900/80 backdrop-blur-xl">
      <div className="flex items-center justify-between px-4 h-14">
        <button
          onClick={onMenuClick}
          aria-label="Abrir menu"
          className="h-9 w-9 -ml-1.5 flex items-center justify-center rounded-lg text-graphite-700 dark:text-white/80 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
        >
          <span className="text-lg">☰</span>
        </button>

        <div className="flex items-center gap-2 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="" className="h-6 w-6 rounded-md shrink-0" />
          <span className="text-sm font-semibold text-graphite-900 dark:text-white truncate max-w-[9rem]">
            {companyName ?? 'AP Auto Prime'}
          </span>
        </div>

        <Link
          href="/perfil"
          aria-label="Meu perfil"
          className="h-8 w-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-700 flex items-center justify-center text-white text-xs font-semibold shrink-0"
        >
          {user?.email[0]?.toUpperCase() ?? '?'}
        </Link>
      </div>
    </header>
  );
}
