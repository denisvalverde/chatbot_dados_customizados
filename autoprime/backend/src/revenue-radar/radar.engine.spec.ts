import {
  attributeOutreach,
  buildUpsellModel,
  freeWindows,
  humanSlotLabel,
  normalizeBrazilianPhone,
  personalCadenceDays,
  RadarClientInput,
  RadarInput,
  RadarServiceInput,
  runRadar,
} from './radar.engine';

const TZ = 'America/Sao_Paulo';
// Segunda-feira, 09/11/2026 07:00 em São Paulo (10:00 UTC) — data fixa para
// o motor ser 100% determinístico (ele nunca lê o relógio sozinho).
const NOW = new Date('2026-11-09T10:00:00.000Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);

const SERVICES: RadarServiceInput[] = [
  { id: 'simples', name: 'Lavagem Simples', price: 40, estimatedMinutes: 30 },
  { id: 'completa', name: 'Lavagem Completa', price: 70, estimatedMinutes: 60 },
  { id: 'cristal', name: 'Cristalização de Pintura', price: 350, estimatedMinutes: 180 },
];

function client(overrides: Partial<RadarClientInput> & { clientId: string }): RadarClientInput {
  return {
    name: `Cliente ${overrides.clientId}`,
    phone: '11999990000',
    vehicle: { brand: 'VW', model: 'Golf' },
    visits: [],
    hasUpcomingAppointment: false,
    lastMissed: null,
    lastContactedAt: null,
    ...overrides,
  };
}

const visit = (d: number, serviceIds = ['completa'], value = 70) => ({
  at: daysAgo(d),
  value,
  serviceIds,
});

function input(clients: RadarClientInput[], extra: Partial<RadarInput> = {}): RadarInput {
  return {
    now: NOW,
    timezone: TZ,
    companyName: 'AutoPrime Demo',
    clients,
    services: SERVICES,
    busy: [],
    ...extra,
  };
}

describe('Radar de Receita — utilidades', () => {
  it('normaliza telefones brasileiros para o wa.me', () => {
    expect(normalizeBrazilianPhone('(11) 99999-0000')).toBe('5511999990000');
    expect(normalizeBrazilianPhone('+55 21 3333-4444')).toBe('552133334444');
    expect(normalizeBrazilianPhone('5511999990000')).toBe('5511999990000');
    expect(normalizeBrazilianPhone('12345')).toBeNull();
    expect(normalizeBrazilianPhone(null)).toBeNull();
  });

  it('ritmo pessoal é a mediana dos intervalos, ignorando visitas no mesmo dia', () => {
    expect(personalCadenceDays([visit(60), visit(40), visit(20), visit(20)])).toBe(20);
    expect(personalCadenceDays([visit(10)])).toBeNull();
    // Limitado entre 7 e 180 dias.
    expect(personalCadenceDays([visit(3), visit(1)])).toBe(7);
  });

  it('rótulos de horário em pt-BR no fuso da empresa', () => {
    expect(humanSlotLabel(new Date('2026-11-09T17:00:00.000Z'), NOW, TZ)).toBe('hoje às 14:00');
    expect(humanSlotLabel(new Date('2026-11-10T12:30:00.000Z'), NOW, TZ)).toBe('amanhã às 09:30');
    expect(humanSlotLabel(new Date('2026-11-13T13:00:00.000Z'), NOW, TZ)).toBe(
      'sexta (13/11) às 10:00',
    );
  });
});

describe('Radar de Receita — classificação', () => {
  it('cliente no ponto de voltar (DUE_NOW) pelo próprio ritmo', () => {
    const result = runRadar(
      input([client({ clientId: 'a', visits: [visit(60), visit(40), visit(20)] })]),
    );
    expect(result.opportunities).toHaveLength(1);
    const o = result.opportunities[0];
    expect(o.kind).toBe('DUE_NOW');
    expect(o.cadenceDays).toBe(20);
    expect(o.cadenceSource).toBe('personal');
    expect(o.potentialValue).toBe(70);
    expect(o.expectedValue).toBeCloseTo(70 * 0.45);
    expect(o.reason).toContain('a cada 20 dias');
  });

  it('cliente que sumiu (WIN_BACK) tem probabilidade decrescente com o tempo', () => {
    const recent = runRadar(
      input([client({ clientId: 'a', visits: [visit(80), visit(60), visit(40)] })]),
    );
    const older = runRadar(
      input([client({ clientId: 'a', visits: [visit(140), visit(120), visit(100)] })]),
    );
    expect(recent.opportunities[0].kind).toBe('WIN_BACK');
    expect(older.opportunities[0].kind).toBe('WIN_BACK');
    expect(older.opportunities[0].probability).toBeLessThan(recent.opportunities[0].probability);
    // Faturamento anual em risco = ticket × (365 / ritmo).
    expect(recent.opportunities[0].annualValueAtRisk).toBeCloseTo(70 * (365 / 20));
    expect(recent.summary.annualRevenueAtRisk).toBeCloseTo(70 * (365 / 20));
  });

  it('cliente perdido há mais de um ano não gera ruído', () => {
    const result = runRadar(input([client({ clientId: 'a', visits: [visit(420), visit(400)] })]));
    expect(result.opportunities).toHaveLength(0);
  });

  it('quem já tem agendamento futuro nunca é incomodado', () => {
    const result = runRadar(
      input([
        client({ clientId: 'a', visits: [visit(80), visit(60)], hasUpcomingAppointment: true }),
      ]),
    );
    expect(result.opportunities).toHaveLength(0);
  });

  it('falta recente sem remarcação vira NO_SHOW_RECOVERY com o valor do agendamento perdido', () => {
    const result = runRadar(
      input([
        client({
          clientId: 'a',
          visits: [visit(30)],
          lastMissed: { at: daysAgo(3), status: 'NO_SHOW', value: 350, serviceIds: ['cristal'] },
        }),
      ]),
    );
    const o = result.opportunities[0];
    expect(o.kind).toBe('NO_SHOW_RECOVERY');
    expect(o.potentialValue).toBe(350);
    expect(o.reason).toMatch(/^Faltou no dia/);
    // O horário sugerido comporta os 180 min da cristalização.
    const slot = o.suggestedSlot!;
    expect(new Date(slot.endAt).getTime() - new Date(slot.startAt).getTime()).toBe(180 * 60_000);
  });

  it('cliente com uma visita só usa o ritmo típico da empresa', () => {
    const result = runRadar(
      input([
        client({ clientId: 'ritmo1', visits: [visit(90), visit(60), visit(30)] }), // 30d
        client({ clientId: 'ritmo2', visits: [visit(95), visit(65), visit(35)] }), // 30d
        client({ clientId: 'novo', visits: [visit(28)] }),
      ]),
    );
    const novo = result.opportunities.find((o) => o.clientId === 'novo')!;
    expect(result.benchmarks.companyCadenceDays).toBe(30);
    expect(novo.cadenceSource).toBe('company');
    expect(novo.kind).toBe('DUE_NOW');
  });

  it('contato recente derruba a prioridade e não consome horário da agenda', () => {
    const result = runRadar(
      input([
        client({
          clientId: 'contatado',
          visits: [visit(80), visit(60), visit(40)],
          lastContactedAt: daysAgo(2),
        }),
        client({ clientId: 'novo', visits: [visit(60), visit(40), visit(19)] }),
      ]),
    );
    expect(result.opportunities[0].clientId).toBe('novo');
    const contatado = result.opportunities.find((o) => o.clientId === 'contatado')!;
    expect(contatado.contactedRecently).toBe(true);
    expect(contatado.suggestedSlot).toBeNull();
  });
});

describe('Radar de Receita — upsell por associação', () => {
  it('sugere o serviço que clientes parecidos compram e este ainda não', () => {
    const clients = [
      client({ clientId: 'x', visits: [visit(10, ['completa']), visit(5, ['cristal'], 350)] }),
      client({ clientId: 'y', visits: [visit(12, ['completa']), visit(6, ['cristal'], 350)] }),
      client({ clientId: 'z', visits: [visit(9, ['completa']), visit(2, ['completa'])] }),
    ];
    const best = buildUpsellModel(clients)(clients[2], new Map(SERVICES.map((s) => [s.id, s])));
    expect(best?.service.id).toBe('cristal');
    expect(best?.confidence).toBeCloseTo(2 / 3);
  });

  it('cliente ativo recebe UPSELL; cliente no ponto recebe o upsell embutido na mensagem', () => {
    const base = [
      client({
        clientId: 'x',
        visits: [visit(100, ['completa']), visit(95, ['cristal'], 350)],
        hasUpcomingAppointment: true,
      }),
      client({
        clientId: 'y',
        visits: [visit(100, ['completa']), visit(90, ['cristal'], 350)],
        hasUpcomingAppointment: true,
      }),
    ];
    const ativo = client({ clientId: 'ativo', visits: [visit(45), visit(25), visit(5)] });
    const noPonto = client({ clientId: 'ponto', visits: [visit(60), visit(40), visit(19)] });
    const result = runRadar(input([...base, ativo, noPonto]));

    const up = result.opportunities.find((o) => o.clientId === 'ativo')!;
    expect(up.kind).toBe('UPSELL');
    expect(up.suggestedService?.name).toBe('Cristalização de Pintura');
    expect(up.potentialValue).toBe(350);

    const due = result.opportunities.find((o) => o.clientId === 'ponto')!;
    expect(due.kind).toBe('DUE_NOW');
    expect(due.message).toContain('incluir Cristalização de Pintura');
    expect(due.potentialValue).toBeGreaterThan(70);
  });
});

describe('Radar de Receita — agenda e mensagens', () => {
  it('janelas livres respeitam o horário comercial, agendamentos e a antecedência mínima', () => {
    // Agora = 07:00 local de segunda. Ocupado 08:00–10:00 local.
    const days = freeWindows(NOW, TZ, [
      {
        startAt: new Date('2026-11-09T11:00:00.000Z'),
        endAt: new Date('2026-11-09T13:00:00.000Z'),
      },
    ]);
    const monday = days[0];
    expect(monday.date).toBe('2026-11-09');
    expect(new Date(monday.windows[0].start).toISOString()).toBe('2026-11-09T13:00:00.000Z'); // 10:00
    expect(new Date(monday.windows[0].end).toISOString()).toBe('2026-11-09T21:00:00.000Z'); // 18:00
    // Domingo (15/11) fica de fora.
    expect(days.map((d) => d.date)).not.toContain('2026-11-15');
  });

  it('cada horário livre é oferecido a um único cliente, por ordem de prioridade', () => {
    // Deixa só 1h livre na semana inteira: tudo ocupado menos segunda 08:00–09:00.
    const busy = [
      {
        startAt: new Date('2026-11-09T12:00:00.000Z'),
        endAt: new Date('2026-11-16T12:00:00.000Z'),
      },
    ];
    const result = runRadar(
      input(
        [
          client({ clientId: 'a', visits: [visit(80), visit(60), visit(40)] }),
          client({ clientId: 'b', visits: [visit(81), visit(61), visit(41)] }),
        ],
        { busy },
      ),
    );
    const withSlot = result.opportunities.filter((o) => o.suggestedSlot);
    expect(withSlot).toHaveLength(1);
    expect(withSlot[0].suggestedSlot!.label).toBe('hoje às 08:00');
    expect(withSlot[0].message).toContain('Tenho um horário livre hoje às 08:00');
    const without = result.opportunities.find((o) => !o.suggestedSlot)!;
    expect(without.message).toContain('Posso reservar um horário pra você essa semana?');
  });

  it('capacidade ociosa converte horas livres em R$ pelo ticket médio', () => {
    const result = runRadar(input([client({ clientId: 'a', visits: [visit(40), visit(20)] })]));
    // 6 dias úteis × 10h; segunda começa 08:00 (agora 07:00 + 1h de antecedência).
    expect(result.capacity.days).toHaveLength(6);
    expect(result.capacity.freeSlots).toBe(6 * 10); // ticket médio 60 min
    expect(result.capacity.idleRevenue).toBe(60 * 70);
  });

  it('mensagem personalizada e link de WhatsApp prontos para envio', () => {
    const result = runRadar(
      input([
        client({ clientId: 'a', name: 'carlos silva', visits: [visit(80), visit(60), visit(40)] }),
      ]),
    );
    const o = result.opportunities[0];
    expect(o.message).toMatch(
      /^Oi, Carlos! Aqui é da AutoPrime Demo\. Faz 40 dias que a gente não cuida do seu Golf/,
    );
    expect(o.whatsappUrl).toBe(`https://wa.me/5511999990000?text=${encodeURIComponent(o.message)}`);
  });

  it('sem telefone válido não há link, mas a oportunidade continua visível', () => {
    const result = runRadar(
      input([client({ clientId: 'a', phone: null, visits: [visit(80), visit(60)] })]),
    );
    expect(result.opportunities[0].whatsappUrl).toBeNull();
  });

  it('resumo soma potencial e valor esperado por tipo', () => {
    const result = runRadar(
      input([
        client({ clientId: 'a', visits: [visit(80), visit(60), visit(40)] }),
        client({ clientId: 'b', visits: [visit(60), visit(40), visit(19)] }),
      ]),
    );
    expect(result.summary.opportunities).toBe(2);
    expect(result.summary.potentialRevenue).toBe(140);
    expect(result.summary.byKind.WIN_BACK.count).toBe(1);
    expect(result.summary.byKind.DUE_NOW.count).toBe(1);
    expect(result.summary.expectedRevenue).toBeCloseTo(
      result.opportunities.reduce((s, o) => s + o.expectedValue, 0),
    );
  });
});

describe('Radar de Receita — atribuição de receita recuperada', () => {
  const contact = (id: string, clientId: string, d: number) => ({
    id,
    clientId,
    kind: 'WIN_BACK' as const,
    contactedAt: daysAgo(d),
    estimatedValue: 70,
  });
  const booking = (id: string, clientId: string, d: number, status = 'CONFIRMED', value = 70) => ({
    id,
    clientId,
    createdAt: daysAgo(d),
    status,
    value,
  });

  it('agendamento dentro da janela conta como receita recuperada', () => {
    const r = attributeOutreach([contact('o1', 'a', 10)], [booking('b1', 'a', 8)]);
    expect(r.converted).toBe(1);
    expect(r.recoveredRevenue).toBe(70);
    expect(r.byKind.WIN_BACK.converted).toBe(1);
  });

  it('não atribui agendamento anterior ao contato, fora da janela ou cancelado', () => {
    const r = attributeOutreach(
      [contact('o1', 'a', 30), contact('o2', 'b', 10), contact('o3', 'c', 10)],
      [
        booking('antes', 'b', 12),
        booking('tarde', 'a', 1), // 29 dias depois do contato
        booking('cancelado', 'c', 5, 'CANCELLED'),
      ],
    );
    expect(r.converted).toBe(0);
    expect(r.recoveredRevenue).toBe(0);
  });

  it('cada agendamento é atribuído uma vez, ao contato mais recente', () => {
    const r = attributeOutreach(
      [contact('antigo', 'a', 12), contact('recente', 'a', 6)],
      [booking('b1', 'a', 4, 'COMPLETED', 120)],
    );
    expect(r.converted).toBe(1);
    expect(r.conversions[0].outreachId).toBe('recente');
    expect(r.conversionRate).toBe(0.5);
    expect(r.recoveredRevenue).toBe(120);
  });
});
