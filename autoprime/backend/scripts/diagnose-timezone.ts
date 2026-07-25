/**
 * Diagnóstico somente-leitura de possível deslocamento de fuso horário em
 * agendamentos já persistidos. NÃO MODIFICA NENHUM DADO — apenas lê e
 * imprime um relatório para decisão humana.
 *
 * Heurística: antes desta correção, "horário comercial" (08:00–18:00) era
 * interpretado no fuso do processo que gerou o registro (variável conforme
 * o ambiente: UTC no Railway, fuso local em quem rodou localmente). Isso não
 * afeta agendamentos criados pelo painel (`startAt` já chega como instante
 * absoluto do input do usuário) — o risco está nos horários que a IA sugeriu
 * e que podem ter sido aceitos sem revalidação visual do horário exibido.
 *
 * Este script não pode "corrigir" nada sozinho: sem saber, para cada
 * registro, se o instante gravado já era o pretendido ou se já veio
 * deslocado, qualquer ajuste automático arriscaria trocar um dado correto
 * por um errado. Por isso ele só lista candidatos suspeitos para revisão
 * manual (comparando com o cliente, se necessário).
 *
 * Uso:
 *   cd autoprime/backend
 *   DATABASE_URL=... npx ts-node scripts/diagnose-timezone.ts [--timezone America/Sao_Paulo]
 */
import { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';

const prisma = new PrismaClient();

const DEFAULT_TIMEZONE = 'America/Sao_Paulo';
const BUSINESS_START_HOUR = 6; // margem abaixo do expediente oficial (08:00)
const BUSINESS_END_HOUR = 21; // margem acima do expediente oficial (18:00)

function parseArgTimezone(): string {
  const flagIndex = process.argv.indexOf('--timezone');
  if (flagIndex !== -1 && process.argv[flagIndex + 1]) {
    return process.argv[flagIndex + 1];
  }
  return DEFAULT_TIMEZONE;
}

async function main() {
  const fallbackTimezone = parseArgTimezone();
  console.log('=== Diagnóstico de fuso horário — AutoPrime (somente leitura) ===\n');

  const companies = await prisma.company.findMany({
    select: { id: true, name: true, slug: true, timezone: true },
  });

  if (companies.length === 0) {
    console.log('Nenhuma empresa encontrada.');
    return;
  }

  let totalSuspects = 0;

  for (const company of companies) {
    const timezone = company.timezone || fallbackTimezone;
    const appointments = await prisma.appointment.findMany({
      where: { companyId: company.id },
      select: { id: true, startAt: true, endAt: true, status: true, createdAt: true },
      orderBy: { startAt: 'asc' },
    });

    const suspects = appointments.filter((a) => {
      const localHour = DateTime.fromJSDate(a.startAt, { zone: 'utc' }).setZone(timezone).hour;
      return localHour < BUSINESS_START_HOUR || localHour >= BUSINESS_END_HOUR;
    });

    console.log(
      `Empresa: ${company.name} (${company.slug}) — fuso configurado: ${timezone} — ` +
        `${appointments.length} agendamento(s), ${suspects.length} suspeito(s) fora de ${BUSINESS_START_HOUR}h–${BUSINESS_END_HOUR}h local`,
    );

    for (const a of suspects) {
      const local = DateTime.fromJSDate(a.startAt, { zone: 'utc' })
        .setZone(timezone)
        .toFormat('yyyy-LL-dd HH:mm ZZZZ');
      console.log(
        `  - Appointment ${a.id}: startAt=${a.startAt.toISOString()} (${local} em ${timezone}), status=${a.status}`,
      );
    }

    totalSuspects += suspects.length;
  }

  console.log(`\nTotal de agendamentos suspeitos: ${totalSuspects}`);
  console.log(
    'Nenhum dado foi alterado. Revise manualmente os registros suspeitos junto ao ' +
      'cliente/empresa antes de decidir se algum precisa de correção pontual.',
  );
}

main()
  .catch((error) => {
    console.error('Falha ao rodar o diagnóstico:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
