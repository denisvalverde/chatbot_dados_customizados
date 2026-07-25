'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { Role } from '@/lib/types';
import { navItemsForRole } from './DesktopSidebar';

const CLIENT_ITEMS = [
  { href: '/dashboard', label: 'Início', icon: '🏠' },
  { href: '/agendar', label: 'Agendar', icon: '➕' },
  { href: '/historico', label: 'Histórico', icon: '🕘' },
  { href: '/assinatura', label: 'Assinatura', icon: '⭐' },
  { href: '/perfil', label: 'Perfil', icon: '👤' },
];

const STAFF_EXCLUDE = new Set(['/agendar', '/historico', '/assinatura', '/perfil']);

export function MobileBottomNavigation({
  role,
  onMore,
}: {
  role: Role | null;
  onMore: () => void;
}) {
  const pathname = usePathname();

  const items =
    role === 'CLIENT'
      ? CLIENT_ITEMS
      : navItemsForRole(role)
          .filter((i) => !STAFF_EXCLUDE.has(i.href))
          .slice(0, 3)
          .map((i) => ({ href: i.href, label: i.label === 'Dashboard' ? 'Início' : i.label, icon: i.icon }));

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-black/5 dark:border-white/10 bg-white/90 dark:bg-graphite-900/90 backdrop-blur-xl pb-safe">
      <div className={cn('grid', role === 'CLIENT' ? 'grid-cols-5' : 'grid-cols-4')}>
        {items.map((item) => {
          const active = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 py-2 min-h-[3.25rem] text-[11px] font-medium transition-colors',
                active ? 'text-primary-500' : 'text-graphite-500 dark:text-white/50',
              )}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
        {role !== 'CLIENT' && (
          <button
            onClick={onMore}
            className="flex flex-col items-center justify-center gap-0.5 py-2 min-h-[3.25rem] text-[11px] font-medium text-graphite-500 dark:text-white/50"
          >
            <span className="text-lg leading-none">⋯</span>
            Mais
          </button>
        )}
      </div>
    </nav>
  );
}
