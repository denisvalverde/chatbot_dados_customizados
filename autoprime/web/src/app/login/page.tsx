'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { saveSession } from '@/lib/auth';
import { LoginResponse } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@autoprime.app');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [needsOtp, setNeedsOtp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post<LoginResponse | { requiresOtp: true }>(
        '/auth/login',
        { email, password, otp: otp || undefined },
        false,
      );

      if ('requiresOtp' in res) {
        setNeedsOtp(true);
        return;
      }

      saveSession(res.accessToken, res.refreshToken, res.user);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao entrar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden -z-10">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-primary-500/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-success/10 blur-3xl" />
      </div>

      <Card className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-192.png"
            alt="AutoPrime"
            className="h-14 w-14 rounded-2xl shadow-lg shadow-primary-500/30 mb-3"
          />
          <h1 className="text-xl font-semibold">AutoPrime</h1>
          <p className="text-sm text-graphite-500 dark:text-white/50">
            Gestão premium de lava-rápido e estética automotiva
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@empresa.com"
            />
          </div>
          <div>
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {needsOtp && (
            <div>
              <Label htmlFor="otp">Código de autenticação (2FA)</Label>
              <Input id="otp" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="000000" />
            </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          <Button type="submit" disabled={loading} className="w-full mt-2">
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>

        <p className="text-xs text-center text-graphite-400 dark:text-white/40 mt-6">
          Login social (Google/Apple) e recuperação de senha disponíveis via API — integração de UI
          prevista na fase 2.
        </p>
      </Card>
    </div>
  );
}
