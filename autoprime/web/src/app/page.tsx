'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { getAccessToken, getCurrentUser } from '@/lib/auth';
import { SITE, whatsappHref } from '@/lib/config';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ServiceCard } from '@/components/ui/ServiceCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton';

interface PublicService {
  id: string;
  name: string;
  category: string;
  description?: string;
  price: string;
  estimatedMinutes: number;
}

interface PublicBranch {
  id: string;
  name: string;
  slug: string;
  city?: string;
  state?: string;
  address?: string;
  number?: string;
  district?: string;
  phone?: string;
  whatsapp?: string;
  acceptsAppointments: boolean;
}

const BENEFITS = [
  { title: 'Equipe treinada', description: 'Profissionais experientes seguem checklist próprio em cada etapa do serviço.' },
  { title: 'Agendamento fácil', description: 'Marque seu horário em poucos passos e acompanhe o status do seu veículo.' },
  { title: 'Produtos premium', description: 'Materiais e produtos selecionados para proteger a pintura e o interior do seu carro.' },
  { title: 'Acompanhamento em tempo real', description: 'Saiba quando seu veículo entra em preparo e quando está pronto para retirada.' },
];

export default function HomePage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);

  const [services, setServices] = useState<PublicService[] | null>(null);
  const [branches, setBranches] = useState<PublicBranch[] | null>(null);
  const [citySearch, setCitySearch] = useState('');

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setCheckingSession(false);
      return;
    }
    const user = getCurrentUser();
    if (user?.role === 'CLIENT') {
      router.replace('/agendar');
    } else if (user) {
      router.replace('/dashboard');
    } else {
      setCheckingSession(false);
    }
  }, [router]);

  useEffect(() => {
    const slug = SITE.defaultCompanySlug;
    if (!slug) {
      setServices([]);
      setBranches([]);
      return;
    }
    api
      .get<PublicService[]>(`/companies/${slug}/services`, false)
      .then(setServices)
      .catch(() => setServices([]));
    api
      .get<PublicBranch[]>(`/companies/${slug}/branches`, false)
      .then(setBranches)
      .catch(() => setBranches([]));
  }, []);

  const filteredBranches = useMemo(() => {
    if (!branches) return null;
    const term = citySearch.trim().toLowerCase();
    if (!term) return branches;
    return branches.filter((b) => (b.city ?? '').toLowerCase().includes(term) || b.name.toLowerCase().includes(term));
  }, [branches, citySearch]);

  if (checkingSession && getAccessToken()) return null;

  const waHref = whatsappHref('Olá! Vim pelo site e quero agendar um horário na AP Auto Prime.');

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 pt-safe border-b border-black/5 dark:border-white/10 bg-white/80 dark:bg-graphite-950/80 backdrop-blur-xl">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-4 sm:px-6 h-14">
          <div className="flex items-center gap-2 min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-192.png" alt="AP Auto Prime" className="h-7 w-7 rounded-lg shrink-0" />
            <span className="text-sm sm:text-base font-semibold text-graphite-900 dark:text-white truncate">
              AP Auto Prime
            </span>
          </div>
          <Link href="/login" className="text-sm font-medium text-primary-500 hover:underline shrink-0">
            Entrar
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-32 -left-32 h-80 w-80 rounded-full bg-primary-500/20 blur-3xl" />
          <div className="absolute -bottom-32 -right-32 h-80 w-80 rounded-full bg-success/10 blur-3xl" />
        </div>
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-12 sm:py-20 text-center flex flex-col items-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-500/30 bg-primary-500/10 px-3 py-1 text-xs font-medium text-primary-500 mb-5">
            Estética automotiva & lava-rápido
          </span>
          <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight text-graphite-900 dark:text-white leading-tight max-w-3xl">
            Seu carro impecável, com o cuidado de um app premium.
          </h1>
          <p className="mt-4 text-base sm:text-lg text-graphite-500 dark:text-white/60 max-w-xl">
            Agende seu horário em poucos toques, acompanhe cada etapa do serviço e retire seu
            veículo pronto, no tempo combinado.
          </p>
          <div className="mt-7 flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Link href="/cadastro" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto px-6">Agendar agora</Button>
            </Link>
            <a href="#unidades" className="w-full sm:w-auto">
              <Button variant="secondary" className="w-full sm:w-auto px-6">
                Encontrar uma unidade
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Unidades */}
      <section id="unidades" className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-8 sm:py-12">
        <h2 className="text-xl sm:text-2xl font-semibold text-graphite-900 dark:text-white mb-1">
          Nossas unidades
        </h2>
        <p className="text-sm text-graphite-500 dark:text-white/50 mb-5">
          Escolha a unidade mais próxima de você.
        </p>

        {branches === null && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {branches !== null && branches.length === 0 && (
          <EmptyState
            icon="📍"
            title="Novidades em breve"
            description="Ainda estamos publicando os endereços das nossas unidades. Fale com o suporte para mais informações."
          />
        )}

        {branches !== null && branches.length > 0 && (
          <>
            <input
              value={citySearch}
              onChange={(e) => setCitySearch(e.target.value)}
              placeholder="Buscar por cidade..."
              className="mb-3 w-full sm:w-72 min-h-[44px] rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-graphite-800 px-3 text-sm outline-none focus:border-primary-500"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(filteredBranches ?? []).map((b) => (
                <Card key={b.id} className="!p-4">
                  <h3 className="font-medium text-graphite-900 dark:text-white">{b.name}</h3>
                  {(b.address || b.city) && (
                    <p className="text-sm text-graphite-500 dark:text-white/50 mt-1">
                      {[b.address && b.number ? `${b.address}, ${b.number}` : b.address, b.district, b.city, b.state]
                        .filter(Boolean)
                        .join(' — ')}
                    </p>
                  )}
                  <div className="mt-2">
                    <Link href={`/cadastro?empresa=${SITE.defaultCompanySlug}&unidade=${b.slug}`}>
                      <Button size="sm" variant="secondary">
                        Agendar nesta unidade
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Serviços em destaque */}
      {(services === null || services.length > 0) && (
        <section className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-8 sm:py-12">
          <h2 className="text-xl sm:text-2xl font-semibold text-graphite-900 dark:text-white mb-1">
            Serviços
          </h2>
          <p className="text-sm text-graphite-500 dark:text-white/50 mb-5">
            Preços e duração estimada, direto do nosso catálogo.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {services === null ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : (
              services.map((s) => (
                <ServiceCard
                  key={s.id}
                  name={s.name}
                  category={s.category}
                  description={s.description}
                  price={Number(s.price)}
                  estimatedMinutes={s.estimatedMinutes}
                />
              ))
            )}
          </div>
        </section>
      )}

      {/* Benefícios */}
      <section className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-8 sm:py-12">
        <h2 className="text-xl sm:text-2xl font-semibold text-graphite-900 dark:text-white mb-5">
          Por que escolher a AP Auto Prime
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {BENEFITS.map((b) => (
            <Card key={b.title} className="!p-4">
              <h3 className="font-medium text-graphite-900 dark:text-white">{b.title}</h3>
              <p className="text-sm text-graphite-500 dark:text-white/50 mt-1">{b.description}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Contato */}
      {waHref && (
        <section className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-4 sm:py-6">
          <Card className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="font-medium text-graphite-900 dark:text-white">Fale conosco</h3>
              <p className="text-sm text-graphite-500 dark:text-white/50 mt-1">
                Dúvidas antes de agendar? Chame a gente no WhatsApp.
              </p>
            </div>
            <a href={waHref} target="_blank" rel="noopener noreferrer" className="shrink-0">
              <Button variant="secondary">Chamar no WhatsApp</Button>
            </a>
          </Card>
        </section>
      )}

      {/* Rodapé */}
      <footer className="mt-auto border-t border-black/5 dark:border-white/10 px-4 sm:px-6 py-8 pb-safe">
        <div className="mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-graphite-500 dark:text-white/50">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-192.png" alt="" className="h-6 w-6 rounded-md" />
            <span className="font-medium text-graphite-700 dark:text-white/70">AP Auto Prime</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-primary-500">Entrar</Link>
            <Link href="/cadastro" className="hover:text-primary-500">Criar conta</Link>
          </div>
          <span>© {new Date().getFullYear()} AP Auto Prime. Todos os direitos reservados.</span>
        </div>
      </footer>
    </div>
  );
}
