'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { saveSession } from '@/lib/auth';
import { LoginResponse } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

interface CompanyInfo {
  id: string;
  name: string;
  slug: string;
}

export default function CadastroPage() {
  return (
    <Suspense fallback={null}>
      <CadastroForm />
    </Suspense>
  );
}

function CadastroForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companySlug = searchParams.get('empresa') ?? '';

  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [companyLoading, setCompanyLoading] = useState(true);
  const [companyError, setCompanyError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    document: '',
  });
  const [lgpdConsent, setLgpdConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!companySlug) {
      setCompanyLoading(false);
      setCompanyError(
        'Link de cadastro inválido. Peça ao lava-rápido o link correto (com "?empresa=" na URL).',
      );
      return;
    }

    setCompanyLoading(true);
    api
      .get<CompanyInfo>(`/companies/by-slug/${companySlug}`, false)
      .then((res) => {
        setCompany(res);
        setCompanyError(null);
      })
      .catch(() => {
        setCompanyError('Empresa não encontrada. Verifique o link de cadastro.');
      })
      .finally(() => setCompanyLoading(false));
  }, [companySlug]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!company) {
      setError('Não foi possível identificar a empresa deste cadastro.');
      return;
    }

    if (!lgpdConsent) {
      setError('É necessário aceitar o uso dos seus dados (LGPD) para continuar.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post<LoginResponse>(
        '/auth/register',
        {
          companySlug: company.slug,
          name: form.name,
          email: form.email,
          password: form.password,
          phone: form.phone || undefined,
          document: form.document || undefined,
          lgpdConsent: 'true',
        },
        false,
      );

      saveSession(res.accessToken, res.refreshToken, res.user);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao criar conta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 pt-safe pb-safe">
      <div className="absolute inset-0 overflow-hidden -z-10">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-primary-500/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-success/10 blur-3xl" />
      </div>

      <Card className="w-full max-w-md">
        <Link
          href="/"
          className="inline-block text-xs text-graphite-400 dark:text-white/40 hover:text-primary-500 mb-4"
        >
          ← Voltar ao site
        </Link>
        <div className="flex flex-col items-center mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-192.png"
            alt="AP Auto Prime"
            className="h-14 w-14 rounded-2xl shadow-lg shadow-primary-500/30 mb-3"
          />
          <h1 className="text-xl font-semibold">Criar conta</h1>
          <p className="text-sm text-graphite-500 dark:text-white/50 text-center">
            {company
              ? `Cadastre-se para agendar seus serviços em ${company.name}`
              : 'Cadastre-se para agendar seus serviços no AutoPrime'}
          </p>
        </div>

        {companyLoading && (
          <p className="text-sm text-center text-graphite-500 dark:text-white/50">
            Verificando empresa...
          </p>
        )}

        {!companyLoading && companyError && (
          <p className="text-sm text-center text-danger">{companyError}</p>
        )}

        {!companyLoading && company && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <Label htmlFor="name">Nome completo</Label>
              <Input
                id="name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Seu nome"
              />
            </div>

            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="voce@email.com"
              />
            </div>

            <div>
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Mínimo 8 caracteres"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="(11) 99999-0000"
                />
              </div>
              <div>
                <Label htmlFor="document">CPF</Label>
                <Input
                  id="document"
                  value={form.document}
                  onChange={(e) => setForm({ ...form, document: e.target.value })}
                  placeholder="000.000.000-00"
                />
              </div>
            </div>

            <label className="flex items-start gap-2 text-xs text-graphite-500 dark:text-white/50">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={lgpdConsent}
                onChange={(e) => setLgpdConsent(e.target.checked)}
              />
              Aceito o uso dos meus dados pessoais para agendamento e comunicação, conforme a LGPD.
            </label>

            {error && <p className="text-sm text-danger">{error}</p>}

            <Button type="submit" disabled={loading} className="w-full mt-2">
              {loading ? 'Criando conta...' : 'Criar conta'}
            </Button>
          </form>
        )}

        <p className="text-sm text-center text-graphite-500 dark:text-white/50 mt-6">
          Já tem conta?{' '}
          <Link href="/login" className="text-primary-500 font-medium hover:underline">
            Entrar
          </Link>
        </p>
      </Card>
    </div>
  );
}
