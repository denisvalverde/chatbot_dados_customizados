# Auditoria — AutoPrime (2026-07-25)

> Escopo: repositório `denisvalverde/chatbot_dados_customizados`, branch
> `claude/autoprime-complete-system-reveaf` (não mesclada em `master`), pasta
> `autoprime/`. Este é o código real por trás do domínio publicado
> `truthful-empathy-production-e4ef.up.railway.app` e do serviço de API
> `chatbotdadoscustomizados-production.up.railway.app`, dentro do projeto
> Railway `modest-insight` (`f1cddf32-...`).
>
> Nota: o `master` deste repositório contém apenas um app Streamlit legado
> (`legacy-streamlit-app/`) sem relação com o AutoPrime — todo o trabalho
> relevante está na branch `claude/autoprime-complete-system-reveaf`.

## 1. Stack encontrada

- **Backend**: NestJS 10 + TypeScript + Prisma 5 (PostgreSQL) + Redis (ioredis,
  ainda sem uso funcional além de estar disponível) + Passport/JWT + bcrypt +
  otplib (2FA TOTP) + Helmet + class-validator/class-transformer +
  `@nestjs/throttler` + Jest/Supertest. Gerenciador: **npm** (`package-lock.json`
  presente e consistente — não misturar com yarn/pnpm).
- **Frontend**: Next.js 14 (App Router) + React 18 + TypeScript + Tailwind CSS
  + Recharts + js-cookie. Também npm.
- **Banco**: PostgreSQL (Railway managed), migrations Prisma versionadas
  (2 migrations: `init` e `multi_tenant`).
- **Infra**: Docker (Dockerfile próprio para backend e para web), Docker
  Compose local com Postgres + Redis + backend + web + Nginx, deploy Railway
  via `railway.json` (builder Dockerfile) em cada subpasta.
- **IA**: SDK oficial `@anthropic-ai/sdk`, usado apenas para geração de texto
  de comunicação com fallback determinístico por template — não é o core do
  produto.

## 2. Arquitetura atual

Monorepo simples (sem workspaces declarados) com duas aplicações
independentes, cada uma com seu próprio `package.json`/lockfile/Dockerfile:

```
autoprime/
├── backend/   NestJS + Prisma — API REST em /api/v1, Swagger em /api/docs
├── web/       Next.js — painel administrativo + cadastro público
├── infra/nginx/  proxy reverso opcional para desenvolvimento local
└── docs/      manuais de usuário/admin + guia de deploy Railway
```

Backend organizado por módulo de domínio (auth, company, clients, vehicles,
catalog, scheduling, service-orders, financial, inventory, employees,
dashboard, notifications, payments, ai), com `common/` para guards,
decorators, interceptors e filtro de exceção compartilhados.

**Multi-tenant**: já implementado (commit `897a0136`, 2026-07-25). Toda
entidade de negócio tem `companyId`. O `companyId` nunca é aceito do corpo da
requisição — vem exclusivamente do JWT via `@CompanyId()` (decorator que lê
`request.user.companyId`), e os DTOs de entrada não têm campo `companyId`
(bloqueado adicionalmente por `forbidNonWhitelisted: true` no
`ValidationPipe` global). `SUPER_ADMIN` tem `companyId` nulo e só acessa
`/companies/*` (guardado por `@Roles(SUPER_ADMIN)`), nunca dados de negócio.
Isso corresponde ao modelo `Company → User(companyId) → Client/Employee →
Vehicle/Appointment/...` pedido, exceto que **não há conceito de `Branch`**
(unidade/filial) — cada empresa opera como unidade única.

**AuthN/AuthZ**: JWT access+refresh (refresh com hash SHA-256 em banco,
revogável, `jti` único por emissão), 2FA TOTP opcional, guard global
`JwtAuthGuard` (com `@Public()` para rotas abertas) + `RolesGuard` aplicado
por controller com `@Roles(...)`. Papéis: `SUPER_ADMIN, ADMIN, MANAGER,
EMPLOYEE, WASHER, DETAILER, FINANCE, CLIENT` — mapeiam para os papéis pedidos,
com granularidade de operação (lavador/detalhador) em vez dos genéricos
"technician"/"receptionist".

## 3. Funcionalidades existentes (reais, testadas, não-mockup)

- Cadastro de empresa (só via `SUPER_ADMIN`), consulta pública por slug.
- Cadastro público de cliente vinculado a uma empresa (`?empresa=slug`),
  aceite LGPD obrigatório, criação de conta staff por admin.
- Login com JWT + refresh + revogação + 2FA TOTP opcional.
- Clientes: CRUD, busca, soft-delete (`isActive=false`).
- Veículos: CRUD vinculado a cliente+empresa, busca por placa.
- Catálogo de serviços: CRUD com checklist e produtos consumidos.
- Agenda: criação de agendamento com cálculo de duração pela soma dos
  serviços, **checagem de conflito de horário por funcionário** dentro de
  transação/consulta (`assertEmployeesAvailable`), reagendamento, cancelamento,
  mudança de status.
- Ordens de serviço: ciclo completo (abrir → iniciar → checklist → fotos →
  concluir → entregar), baixa automática de estoque, lançamento financeiro.
- Financeiro: transações, fluxo de caixa, DRE.
- Estoque: produtos, fornecedores, movimentações, alerta de estoque baixo.
- Equipe: turnos, ponto (check-in/check-out), comissão.
- Dashboard: KPIs, top serviços, produtividade por funcionário, horários de
  pico.
- Pagamentos: geração de PIX "copia e cola" real (payload EMV do Bacen,
  escaneável), adapters Stripe/Mercado Pago em modo sandbox.
- Notificações: e-mail real via SMTP (dry-run se não configurado), WhatsApp/
  push com mock quando sem credenciais.
- IA: sugestão determinística de horários livres, identificação de clientes
  VIP/inativos, geração de mensagens via Claude com fallback por template.
- Interceptor de auditoria (loga toda mutação HTTP com redação de campos
  sensíveis) e interceptor de sanitização (remove `passwordHash`/
  `twoFactorSecret` de qualquer resposta, mesmo se um include futuro os
  trouxer).
- Rate limiting global (100 req/60s) via `@nestjs/throttler`.
- Testes: 19 unitários (auth, agenda, OS, financeiro, PIX, IA) + 8 e2e
  (rodam contra Postgres real). PWA instalável no painel web.

## 4. Funcionalidades incompletas ou fora do escopo atual

Documentado com honestidade no próprio `autoprime/README.md`, confirmado por
esta auditoria:

- **Multi-filial (`Branch`)**: não existe. Cada empresa é uma unidade só.
- **Planos/assinaturas** (`Plan`, `Subscription`, créditos recorrentes): não
  existe nenhum model nem lógica — pedido explicitamente no escopo original,
  ausente por completo.
- **Feed da empresa** (posts, promoções, cupons visíveis ao cliente): não
  existe. Existe `Review` (avaliação pós-atendimento) mas sem endpoint/
  controller — está apenas no schema, sem `ReviewsModule`.
- **Cupons e fidelidade** (`Coupon`, `LoyaltyAccount`): schema existe, zero
  lógica de negócio (nenhum controller/service usa esses models).
- **Login social (Google/Apple)**: colunas existem no `User`, sem fluxo OAuth
  implementado.
- **Integrações reais de pagamento/WhatsApp/push**: adapters prontos, mas
  sempre em modo mock/sandbox (nenhuma credencial configurada — nem deveria,
  não foram fornecidas).
- **App mobile nativo**: não existe (PWA cobre o caso de uso mobile-web).
- Nenhuma tela pública de **agendamento self-service para o cliente final**
  (stepper "escolha serviço → data → confirmação" do pedido original) — o
  painel web atual é voltado à operação interna (admin/equipe), não a um
  fluxo de cliente. O cadastro público existe, mas não há reserva de horário
  pelo próprio cliente sem ser staff.

## 5. Problemas técnicos

1. **Bug real de fuso horário** em `AiService.suggestSlots`
   (`autoprime/backend/src/ai/ai.service.ts`): horários de expediente são
   construídos com `new Date(`${date}T08:00:00`)`, sem offset — o resultado
   depende do fuso horário do processo Node. Rodando localmente nesta
   auditoria, o teste unitário correspondente **falhou**
   (`ai.service.spec.ts`, 1 de 20 testes falhando) porque o horário das 8h
   não aparece como livre. Em produção (Railway, contêiner em UTC) os
   horários "livres" sugeridos não correspondem ao horário comercial real em
   horário de Brasília. Nenhum campo de fuso horário existe em `Company`.
2. **Sem `.env.example`**: `autoprime/README.md` instrui
   `cp backend/.env.example backend/.env` e `cp .env.local.example
   .env.local`, mas **nenhum dos dois arquivos existe no repositório** — todo
   onboarding local quebra no primeiro passo.
3. **README desatualizado**: a seção "fora do escopo" ainda lista
   "multiempresa/multifilial... lógica de negócio não implementada", mas o
   multi-tenant foi implementado depois (commit `897a0136`) sem atualizar
   esse trecho.
4. CPF (`document`) e placa (`plate`) são **armazenados sem normalização nem
   validação de formato** — aceita qualquer string, sem checar dígitos
   verificadores do CPF nem formatos Mercosul/antigo da placa. A unicidade de
   CPF por empresa é garantida só no banco (`@@unique([companyId, document])`),
   o que é correto, mas dados inconsistentes (com/sem pontuação) escapam
   dessa constraint.
5. Branch de trabalho (`claude/autoprime-complete-system-reveaf`) nunca foi
   mesclada à `master` — todo histórico e o código em produção vivem fora do
   branch principal, risco de confusão/perda de contexto para quem olhar só
   a `master`.
6. `ioredis`/Redis está provisionado e conectável, mas **não há nenhum uso
   funcional** no código (nem cache, nem fila, nem sessão) — custo de infra
   sem benefício atual.
7. `npm audit`: 57 vulnerabilidades no backend (1 crítica, 37 altas — via
   `npm ci`) e 16 altas no frontend, majoritariamente em dependências
   transitivas de ferramental (eslint 8 antigo, etc.), não necessariamente
   exploráveis em runtime — recomenda-se revisão pontual antes de
   `audit fix --force` (proibido pelas regras deste projeto sem validação).

## 6. Falhas de segurança (ordem de severidade)

1. **CRÍTICA — corrigida durante esta auditoria**: o backend em produção
   rodava **sem `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` configurados** no
   Railway (só existiam `DATABASE_URL` e `REDIS_URL`). O código usa como
   fallback os valores literais `'dev-access-secret'` /
   `'dev-refresh-secret'`, publicados no próprio repositório
   (`src/config/configuration.ts`). Isso significa que **qualquer pessoa que
   lesse o código-fonte podia forjar um JWT válido para qualquer usuário,
   incluindo `SUPER_ADMIN`**, sem precisar de senha alguma. Ação tomada
   agora: gerei dois segredos aleatórios fortes (96 bytes hex cada) e
   configurei via Railway MCP (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`) no
   serviço `chatbot_dados_customizados` (env. `production`); isso disparou um
   redeploy automático. **Efeito colateral esperado**: todas as sessões
   ativas (access e refresh tokens já emitidos) foram invalidadas — qualquer
   usuário logado precisará logar novamente.
2. **ALTA — ainda pendente, exige decisão do usuário**: o `Dockerfile` do
   backend roda `npx prisma db seed` **a cada boot em produção**
   (`CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed &&
   node dist/src/main"]`), o que recria (via `upsert`) uma empresa "AutoPrime
   Demo" com usuários de senha conhecida e publicada no `README.md`:
   `admin@autoprime.app / Admin@123`, `superadmin@autoprime.app /
   SuperAdmin@123`, etc. Como o Postgres de produção provavelmente só tem
   esse tenant demo até agora, **essas credenciais de admin/super-admin
   documentadas publicamente provavelmente funcionam contra o banco real
   agora mesmo**. Recomendo fortemente: (a) remover o `prisma db seed` do
   `CMD` de produção (seed deve ser passo manual/dev, nunca automático — regra
   explícita deste projeto), e (b) trocar a senha de todo usuário seedado que
   ainda exista no banco de produção, ou desativá-los. Não fiz isso ainda
   porque exige alterar o `Dockerfile` (commit + push + redeploy do serviço
   compartilhado) — prefiro confirmar com você antes de mexer no
   comportamento de boot de um serviço já em produção.
3. **MÉDIA**: CORS totalmente aberto (`cors: true` em `main.ts`) — o próprio
   `DEPLOY_RAILWAY.md` já recomenda restringir a `WEB_URL`; variável
   `WEB_URL` também não está configurada no Railway hoje.
4. **BAIXA**: `AuditLogInterceptor.redact` só troca campos de nível superior
   (`password`, `token`, etc.) — não teria como vazar senha (não está no
   payload de rotas fora de auth), mas CPF/endereço de clientes ficam
   armazenados em texto pleno dentro de `AuditLog.metadata`. Não é log em
   disco (fica em tabela com controle de acesso), mas vale mascarar CPF ali
   por princípio de minimização de dado (LGPD).
5. Nenhuma variável de segredo (`JWT_*`, `SMTP_*`, chaves de pagamento,
   `ANTHROPIC_API_KEY`) aparece nos nomes listados publicamente aqui — só
   nomes, nunca valores, conforme solicitado.

## 7. Riscos de perda ou vazamento de dados

- Enquanto o item 6.2 (seed automático) não for corrigido, cada redeploy do
  backend **recria/atualiza** os usuários demo (idempotente via `upsert`,
  não apaga dados reais de outras empresas), mas mantém uma porta de entrada
  administrativa com senha pública enquanto essa empresa demo continuar
  ativa em produção.
- Não há RLS (Row Level Security) no Postgres — isolamento de tenant depende
  100% da camada de aplicação (Prisma + `@CompanyId()`). Na revisão de código
  não encontrei nenhuma query de negócio que ignore `companyId`, mas não há
  uma segunda camada de defesa no banco caso um novo endpoint futuro esqueça
  o filtro. Recomendo considerar RLS como camada adicional antes de
  onboarding de clientes reais (ver plano, item P3).
- Backups do Postgres: gerenciados pelo Railway (managed Postgres); não
  verifiquei politica de retenção/backup automático do plugin — vale
  confirmar no painel Railway antes de colocar dados reais de clientes.

## 8. Inconsistências de banco

- Duas migrations aplicadas em sequência coerente (`init` →
  `multi_tenant` com backfill para a empresa "AutoPrime Demo"). Nenhuma
  migration pendente detectada localmente (`prisma migrate deploy` roda sem
  erro no Docker build).
- Índices presentes nos campos certos (`companyId`, `status`, datas de
  agendamento, etc.) — cobertura já boa.
- Faltam: índice/normalização de `document` (CPF) e `plate` prontos para
  busca exata pós-normalização (hoje a busca por placa já é
  case-insensitive, mas não remove hífen/espaço).
- `Coupon` e `LoyaltyAccount` são schema morto (sem código que os popule ou
  leia) — não é inconsistência de dados, mas manutenção de schema não usado.

## 9. Problemas de experiência do usuário

- O painel web cobre bem o lado operacional (admin/equipe), mas **não existe
  nenhuma tela voltada ao cliente final** para se autoagendar (stepper
  "unidade → veículo → serviço → data/hora → revisão → confirmar") — hoje o
  cliente só se cadastra (`/cadastro`); a marcação de horário é feita pela
  equipe via painel.
- Sem tela de "esqueci minha senha" no frontend (o endpoint
  `/auth/forgot-password` existe no backend, mas não há página/formulário
  correspondente em `autoprime/web/src/app`).
- Sem PWA/manifest voltado ao cliente (o PWA existe, mas para o painel
  administrativo).

## 10. Problemas de deploy

- Variáveis de segredo faltando em produção (corrigido parcialmente nesta
  sessão — ver seção 6.1). Ainda faltam, se desejar ativar essas
  funcionalidades: `WEB_URL` (para restringir CORS), `SMTP_*` (e-mail real),
  `ANTHROPIC_API_KEY` (mensagens via Claude — hoje cai no fallback por
  template, o que já é funcional), `PIX_KEY` (hoje usa um valor default
  `pix@autoprime.app`, o que é um espaço reservado e não uma chave real).
- Deploys mais recentes de ambos os serviços (`chatbot_dados_customizados` e
  `truthful-empathy`) estão com status `SUCCESS`; logs de boot do backend
  não mostram erro.
- `railway.json` de cada subpasta está corretamente configurado
  (`builder: DOCKERFILE`, restart on failure).
- Build e lint locais (backend e frontend) passam limpos; 19/20 testes
  unitários do backend passam (1 falha real de fuso horário, ver seção 5.1).

## 11. Plano de implementação priorizado

**P0 — Segurança imediata (produção)**
1. ~~Configurar `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` fortes no Railway~~
   — **feito nesta sessão**.
2. Remover `npx prisma db seed` do `CMD` de produção (`Dockerfile` do
   backend); manter seed como comando manual (`npm run prisma:seed`) só para
   dev/staging.
3. Trocar (ou desativar) as senhas dos usuários seedados que existirem hoje
   no Postgres de produção.
4. Restringir CORS a `WEB_URL` e configurar essa variável no Railway.

**P1 — Correção de bugs reais**
5. Corrigir o cálculo de horário comercial em `AiService.suggestSlots` para
   usar um fuso horário explícito (ex.: `America/Sao_Paulo` fixo, ou campo
   `timezone` em `Company`), consertando o teste que falha hoje.
6. Adicionar `.env.example` (backend) e `.env.local.example` (web) reais,
   com nomes de variável e valores fictícios — sem isso o onboarding local
   documentado no README não funciona.
7. Atualizar `autoprime/README.md` para refletir que multi-tenant já está
   implementado.
8. Normalizar CPF (remover pontuação, validar dígito verificador) e placa
   (maiúsculas, sem espaço/hífen, aceitar Mercosul e formato antigo) antes de
   persistir.

**P2 — Fechar lacunas funcionais do pedido original**
9. Tela pública de autoagendamento para o cliente final (stepper completo).
10. Módulo de avaliações (`Review`) com endpoints — já existe no schema.
11. `Plan`/`Subscription` (planos e assinaturas) — model + lógica de créditos.
12. `Branch` (multi-filial) — só se realmente houver demanda de clientes
    com mais de uma unidade; hoje nenhuma empresa cadastrada precisa disso.
13. Cupons e fidelidade — ativar a lógica sobre o schema já existente.

**P3 — Endurecimento adicional**
14. Considerar Row Level Security no Postgres como segunda camada de defesa
    de tenant, complementando (não substituindo) o filtro por `companyId`
    já feito na aplicação.
15. Mesclar a branch `claude/autoprime-complete-system-reveaf` em `master`
    (ou promovê-la a branch principal), para que o histórico do repositório
    reflita o que está de fato em produção.
16. Revisar `npm audit` das duas aplicações com atenção a vulnerabilidades
    exploráveis em runtime (não apenas ferramental de build).

## 12. O que esta auditoria NÃO fez

- Não alterei nenhum código-fonte ainda (além de gerar/instalar
  `node_modules` localmente para rodar lint/build/testes, que não afeta o
  repositório).
- Não fiz push de nenhum commit nem disparei deploy manual — a única
  mudança em produção foi a configuração dos dois segredos JWT via Railway
  MCP (ação de leitura+escrita direta em variável de ambiente, não em
  código).
- Não toquei no banco de dados de produção (sem acesso a `DATABASE_URL`,
  intencionalmente).
- Não mesclei a branch `claude/autoprime-complete-system-reveaf` em
  `master`.
