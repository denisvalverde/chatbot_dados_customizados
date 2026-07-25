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
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';

interface CompanyInfo {
  id: string;
  name: string;
  slug: string;
}

interface BranchInfo {
  id: string;
  name: string;
  slug: string;
  city?: string;
  state?: string;
  address?: string;
  number?: string;
  district?: string;
}

type Step = 'company' | 'branch' | 'form';

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
  const empresaParam = searchParams.get('empresa') ?? '';
  const unidadeParam = searchParams.get('unidade') ?? '';

  const [step, setStep] = useState<Step>('company');
  const [bootstrapping, setBootstrapping] = useState(true);

  const [companies, setCompanies] = useState<CompanyInfo[] | null>(null);
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [companiesError, setCompaniesError] = useState(false);

  const [branches, setBranches] = useState<BranchInfo[] | null>(null);
  const [branch, setBranch] = useState<BranchInfo | null>(null);
  const [branchesLoading, setBranchesLoading] = useState(false);

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

  // Resolve o estado inicial: se ?empresa= veio na URL, tenta pré-selecionar
  // (sem nunca mostrar erro técnico ao cliente — se for inválida, cai
  // silenciosamente no seletor de empresa).
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (empresaParam) {
        try {
          const found = await api.get<CompanyInfo>(`/companies/by-slug/${empresaParam}`, false);
          if (cancelled) return;
          setCompany(found);
          setStep('branch');
          setBootstrapping(false);
          return;
        } catch {
          // Link inválido/expirado — segue para o seletor normal, sem erro técnico.
        }
      }

      try {
        const list = await api.get<CompanyInfo[]>('/companies/public', false);
        if (cancelled) return;
        setCompanies(list);
        if (list.length === 1) {
          setCompany(list[0]);
          setStep('branch');
        }
      } catch {
        if (!cancelled) setCompaniesError(true);
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ao entrar na etapa de unidade, busca as unidades publicadas da empresa.
  useEffect(() => {
    if (step !== 'branch' || !company) return;

    setBranchesLoading(true);
    api
      .get<BranchInfo[]>(`/companies/${company.slug}/branches`, false)
      .then((list) => {
        setBranches(list);
        const preselected = unidadeParam ? list.find((b) => b.slug === unidadeParam) : undefined;
        if (preselected) {
          setBranch(preselected);
          setStep('form');
        } else if (list.length === 0) {
          // Nenhuma unidade publicada ainda: segue sem escolher (opcional).
          setStep('form');
        }
      })
      .catch(() => setBranches([]))
      .finally(() => setBranchesLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, company]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!company) {
      setError('Escolha uma empresa para continuar.');
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
          branchSlug: branch?.slug,
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
      router.push('/agendar');
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
              : 'Escolha o lava-rápido onde você quer se cadastrar'}
          </p>
        </div>

        {bootstrapping && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        )}

        {!bootstrapping && step === 'company' && (
          <div className="flex flex-col gap-2">
            {companiesError && (
              <EmptyState
                icon="⚠️"
                title="Não foi possível carregar as empresas"
                description="Verifique sua conexão e tente novamente."
                action={
                  <Button size="sm" onClick={() => window.location.reload()}>
                    Tentar de novo
                  </Button>
                }
              />
            )}

            {!companiesError && companies && companies.length === 0 && (
              <EmptyState
                icon="🏢"
                title="Nenhuma empresa disponível no momento"
                description="Fale com o suporte para cadastrar seu lava-rápido no AP Auto Prime."
                action={
                  <Link href="/">
                    <Button size="sm" variant="secondary">
                      Voltar ao site
                    </Button>
                  </Link>
                }
              />
            )}

            {!companiesError &&
              companies &&
              companies.length > 0 &&
              companies.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setCompany(c);
                    setStep('branch');
                  }}
                  className="w-full text-left rounded-xl border border-black/10 dark:border-white/10 px-4 py-3 hover:border-primary-500 hover:bg-primary-500/5 transition-colors min-h-[44px]"
                >
                  <span className="font-medium text-graphite-900 dark:text-white">{c.name}</span>
                </button>
              ))}
          </div>
        )}

        {!bootstrapping && step === 'branch' && company && (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                setStep('company');
                setBranch(null);
              }}
              className="text-xs text-graphite-400 dark:text-white/40 hover:text-primary-500 self-start mb-1"
            >
              ← Trocar empresa
            </button>

            {branchesLoading && (
              <>
                <Skeleton className="h-11 w-full" />
                <Skeleton className="h-11 w-full" />
              </>
            )}

            {!branchesLoading && branches && branches.length === 0 && (
              <EmptyState
                icon="📍"
                title="Nenhuma unidade publicada ainda"
                description="Você pode criar sua conta normalmente e escolher a unidade depois."
                action={
                  <Button size="sm" onClick={() => setStep('form')}>
                    Continuar
                  </Button>
                }
              />
            )}

            {!branchesLoading &&
              branches &&
              branches.length > 0 &&
              branches.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    setBranch(b);
                    setStep('form');
                  }}
                  className="w-full text-left rounded-xl border border-black/10 dark:border-white/10 px-4 py-3 hover:border-primary-500 hover:bg-primary-500/5 transition-colors min-h-[44px]"
                >
                  <span className="font-medium text-graphite-900 dark:text-white block">{b.name}</span>
                  {(b.city || b.district) && (
                    <span className="text-xs text-graphite-500 dark:text-white/50">
                      {[b.district, b.city, b.state].filter(Boolean).join(', ')}
                    </span>
                  )}
                </button>
              ))}
          </div>
        )}

        {!bootstrapping && step === 'form' && company && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <button
              type="button"
              onClick={() => setStep(branches && branches.length > 0 ? 'branch' : 'company')}
              className="text-xs text-graphite-400 dark:text-white/40 hover:text-primary-500 self-start -mt-2"
            >
              ← {branches && branches.length > 0 ? 'Trocar unidade' : 'Trocar empresa'}
            </button>

            {branch && (
              <p className="text-xs text-graphite-500 dark:text-white/50 -mt-1">
                Unidade: <span className="font-medium">{branch.name}</span>
              </p>
            )}

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
