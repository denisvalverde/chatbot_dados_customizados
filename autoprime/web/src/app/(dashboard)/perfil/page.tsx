'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearSession, getCurrentUser, roleLabel } from '@/lib/auth';
import { useCompany } from '@/lib/company-context';
import { AuthUser } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

export default function PerfilPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
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
    <div>
      <PageHeader title="Meu perfil" description="Dados da conta e preferências do app" />

      <Card className="flex items-center gap-4 mb-4">
        <div className="h-14 w-14 shrink-0 rounded-full bg-gradient-to-br from-primary-400 to-primary-700 flex items-center justify-center text-white text-xl font-semibold">
          {user?.email[0]?.toUpperCase() ?? '?'}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-graphite-900 dark:text-white truncate">{user?.email}</p>
          <p className="text-sm text-graphite-500 dark:text-white/50">{user ? roleLabel(user.role) : ''}</p>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <Card>
          <h3 className="text-xs font-medium uppercase tracking-wide text-graphite-500 dark:text-white/50 mb-1">
            Empresa
          </h3>
          <p className="text-graphite-900 dark:text-white">{company?.name ?? '—'}</p>
        </Card>
        <Card>
          <h3 className="text-xs font-medium uppercase tracking-wide text-graphite-500 dark:text-white/50 mb-1">
            Fuso horário
          </h3>
          <p className="text-graphite-900 dark:text-white">{company?.timezone ?? '—'}</p>
        </Card>
      </div>

      <Card className="flex items-center justify-between mb-4">
        <div>
          <p className="font-medium text-graphite-900 dark:text-white">Aparência</p>
          <p className="text-sm text-graphite-500 dark:text-white/50">Tema claro ou escuro do aplicativo</p>
        </div>
        <ThemeToggle />
      </Card>

      <Button variant="danger" className="w-full" onClick={() => setConfirmLogout(true)}>
        Sair da conta
      </Button>

      <ConfirmDialog
        open={confirmLogout}
        title="Sair da conta"
        message="Você precisará entrar novamente com seu e-mail e senha."
        confirmLabel="Sair"
        tone="danger"
        onConfirm={logout}
        onCancel={() => setConfirmLogout(false)}
      />
    </div>
  );
}
