'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getAccessToken, getCurrentUser } from '@/lib/auth';
import { SITE, whatsappHref } from '@/lib/config';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ServiceCard } from '@/components/ui/ServiceCard';

const FEATURED_SERVICES = [
  {
    name: 'Lavagem completa',
    category: 'Lavagem',
    description: 'Lavagem externa, limpeza de rodas e secagem cuidadosa em todo o veículo.',
  },
  {
    name: 'Higienização interna',
    category: 'Estética',
    description: 'Aspiração completa, limpeza de estofados e painel, e eliminação de odores.',
  },
  {
    name: 'Polimento e cristalização',
    category: 'Estética automotiva',
    description: 'Recuperação do brilho da pintura com produtos premium e proteção duradoura.',
  },
  {
    name: 'Lavagem detalhada (detail)',
    category: 'Detail',
    description: 'Processo minucioso por dentro e por fora, indicado para quem exige o melhor acabamento.',
  },
];

const BENEFITS = [
  { icon: '🧑‍🔧', title: 'Equipe treinada', description: 'Profissionais experientes seguem checklist próprio em cada etapa do serviço.' },
  { icon: '📱', title: 'Agendamento fácil', description: 'Marque seu horário em poucos passos e acompanhe o status do seu veículo.' },
  { icon: '🧴', title: 'Produtos premium', description: 'Materiais e produtos selecionados para proteger a pintura e o interior do seu carro.' },
  { icon: '🔔', title: 'Acompanhamento em tempo real', description: 'Saiba quando seu veículo entra em preparo e quando está pronto para retirada.' },
];

export default function HomePage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [ctaHref, setCtaHref] = useState('/login');

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setCheckingSession(false);
      setCtaHref('/login');
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
            <Link href={ctaHref} className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto px-6">Agende seu horário</Button>
            </Link>
            <Link href="/cadastro" className="w-full sm:w-auto">
              <Button variant="secondary" className="w-full sm:w-auto px-6">
                Criar conta de cliente
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Serviços em destaque */}
      <section className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-8 sm:py-12">
        <h2 className="text-xl sm:text-2xl font-semibold text-graphite-900 dark:text-white mb-1">
          Serviços em destaque
        </h2>
        <p className="text-sm text-graphite-500 dark:text-white/50 mb-5">
          Preços e prazos exatos aparecem ao selecionar sua unidade no agendamento.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FEATURED_SERVICES.map((s) => (
            <ServiceCard key={s.name} name={s.name} category={s.category} description={s.description} />
          ))}
        </div>
      </section>

      {/* Próxima disponibilidade */}
      <section className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-4 sm:py-6">
        <Card className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="font-semibold text-graphite-900 dark:text-white">Próxima disponibilidade</h3>
            <p className="text-sm text-graphite-500 dark:text-white/50 mt-1">
              Os horários livres variam por dia e por serviço — confira em tempo real ao iniciar
              seu agendamento.
            </p>
          </div>
          <Link href={ctaHref} className="shrink-0">
            <Button variant="primary" className="w-full sm:w-auto">Ver horários</Button>
          </Link>
        </Card>
      </section>

      {/* Benefícios */}
      <section className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-8 sm:py-12">
        <h2 className="text-xl sm:text-2xl font-semibold text-graphite-900 dark:text-white mb-5">
          Por que escolher a AP Auto Prime
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {BENEFITS.map((b) => (
            <Card key={b.title} className="!p-4">
              <span className="text-2xl">{b.icon}</span>
              <h3 className="font-medium text-graphite-900 dark:text-white mt-2">{b.title}</h3>
              <p className="text-sm text-graphite-500 dark:text-white/50 mt-1">{b.description}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Avaliações */}
      <section className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-4 sm:py-6">
        <Card className="text-center !py-8">
          <span className="text-2xl">⭐</span>
          <h3 className="font-semibold text-graphite-900 dark:text-white mt-2">
            Avaliações verificadas — em implantação
          </h3>
          <p className="text-sm text-graphite-500 dark:text-white/50 mt-1 max-w-md mx-auto">
            Em breve, avaliações reais de clientes atendidos aparecerão aqui automaticamente.
          </p>
        </Card>
      </section>

      {/* Contato / unidade / horário */}
      <section className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-8 sm:py-12">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card>
            <h3 className="font-medium text-graphite-900 dark:text-white mb-1">📍 Unidade</h3>
            <p className="text-sm text-graphite-500 dark:text-white/50">
              {SITE.address || 'Endereço a configurar pela equipe AP Auto Prime.'}
            </p>
          </Card>
          <Card>
            <h3 className="font-medium text-graphite-900 dark:text-white mb-1">🕒 Horário de funcionamento</h3>
            <p className="text-sm text-graphite-500 dark:text-white/50">
              {SITE.businessHours || 'Horário a configurar pela equipe AP Auto Prime.'}
            </p>
          </Card>
          <Card>
            <h3 className="font-medium text-graphite-900 dark:text-white mb-1">💬 Fale conosco</h3>
            {waHref ? (
              <a href={waHref} target="_blank" rel="noopener noreferrer">
                <Button variant="secondary" size="sm" className="mt-1">
                  Chamar no WhatsApp
                </Button>
              </a>
            ) : (
              <p className="text-sm text-graphite-400 dark:text-white/40">
                WhatsApp ainda não configurado para esta unidade.
              </p>
            )}
          </Card>
        </div>
      </section>

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
