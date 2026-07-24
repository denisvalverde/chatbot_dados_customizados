'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { getCurrentUser } from '@/lib/auth';
import { Role } from '@/lib/types';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  roles?: Role[];
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊', roles: ['ADMIN', 'MANAGER', 'FINANCE'] },
  {
    href: '/scheduling',
    label: 'Agenda',
    icon: '📅',
    roles: ['ADMIN', 'MANAGER', 'EMPLOYEE', 'WASHER', 'DETAILER', 'CLIENT'],
  },
  {
    href: '/service-orders',
    label: 'Ordens de Serviço',
    icon: '🧾',
    roles: ['ADMIN', 'MANAGER', 'EMPLOYEE', 'WASHER', 'DETAILER', 'FINANCE'],
  },
  { href: '/clients', label: 'Clientes', icon: '👤', roles: ['ADMIN', 'MANAGER', 'EMPLOYEE', 'FINANCE'] },
  { href: '/services', label: 'Catálogo de Serviços', icon: '🧽', roles: ['ADMIN', 'MANAGER'] },
  { href: '/financial', label: 'Financeiro', icon: '💰', roles: ['ADMIN', 'MANAGER', 'FINANCE'] },
  { href: '/inventory', label: 'Estoque', icon: '📦', roles: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
  { href: '/employees', label: 'Funcionários', icon: '🧑‍🔧', roles: ['ADMIN', 'MANAGER'] },
];

export function Sidebar() {
  const pathname = usePathname();
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    setRole(getCurrentUser()?.role ?? null);
  }, []);

  const items = NAV_ITEMS.filter((item) => !item.roles || !role || item.roles.includes(role));

  return (
    <aside className="hidden lg:flex w-64 flex-col shrink-0 border-r border-black/5 dark:border-white/10 bg-white/70 dark:bg-graphite-900/70 backdrop-blur-xl px-4 py-6">
      <div className="flex items-center gap-2 px-2 mb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="AutoPrime" className="h-8 w-8 rounded-lg shadow-lg shadow-primary-500/30" />
        <span className="text-lg font-semibold tracking-tight text-graphite-900 dark:text-white">
          AutoPrime
        </span>
      </div>

      <nav className="flex flex-col gap-1">
        {items.map((item) => {
          const active = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                active
                  ? 'bg-primary-500/10 text-primary-500 dark:text-primary-400'
                  : 'text-graphite-600 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5',
              )}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
