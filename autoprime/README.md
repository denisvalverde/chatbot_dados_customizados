# AP Auto Prime

Plataforma de gestão para lava-rápido, estética automotiva e detail:
agendamento, ordens de serviço, financeiro, estoque, equipe, multiempresa
(multi-tenant) com múltiplas unidades, painel administrativo premium, PWA
instalável e app Android publicado via Play Store.

## Sumário

- [Estrutura do projeto](#estrutura-do-projeto)
- [Stack técnica](#stack-técnica)
- [O que está implementado](#o-que-está-implementado)
- [O que ainda não está implementado](#o-que-ainda-não-está-implementado)
- [Como rodar localmente](#como-rodar-localmente)
- [Testes](#testes)
- [Publicando externamente](#publicando-externamente)
- [Documentação adicional](#documentação-adicional)

## Estrutura do projeto

```
autoprime/
├── backend/      API REST — NestJS + Prisma + PostgreSQL
├── web/          Painel + site público — Next.js + Tailwind (PWA)
├── android-twa/  Guia e assets para publicar na Play Store (TWA)
├── infra/        Configuração de infraestrutura (NGINX, para uso local)
└── docs/         Manuais de uso, administração e deploy
```

## Stack técnica

**Backend**
- [NestJS](https://nestjs.com/) (Node.js + TypeScript), organizado por módulo de domínio
- [Prisma ORM](https://www.prisma.io/) sobre PostgreSQL
- Autenticação JWT (access + refresh token, refresh revogável) com 2FA opcional (TOTP)
- RBAC (controle de acesso por papel) via guard + decorator `@Roles`
- Rate limiting (`@nestjs/throttler`), log de auditoria em toda mutação
- Swagger/OpenAPI interativo em `/api/docs`
- Redis provisionado (infraestrutura disponível, sem uso funcional ainda)

**Frontend**
- [Next.js 14](https://nextjs.org/) (App Router) + [Tailwind CSS](https://tailwindcss.com/)
- PWA completo: manifest, service worker, ícones (normal + maskable), screenshots
- Mobile-first, com navegação inferior e layout adaptado a papel de cada usuário

**Mobile**
- App Android publicado via **TWA** (Trusted Web Activity) — o próprio PWA
  empacotado como app nativo pela Play Store, sem reescrever em Kotlin/Java
- Gerado com [PWABuilder](https://www.pwabuilder.com/) — ver
  [`android-twa/README.md`](./android-twa/README.md) para o passo a passo completo

**Infraestrutura**
- Docker (uma imagem por serviço) + Docker Compose para desenvolvimento local
- Deploy em produção no [Railway](https://railway.app/) (backend, web, Postgres
  e Redis como serviços independentes)
- CI (`.github/workflows/ci.yml`) rodando lint/build/testes a cada push

## O que está implementado

Tudo abaixo foi implementado, testado (unitário + e2e) e validado rodando de
verdade em produção — não é maquete:

- **Multiempresa (multi-tenant)**: cada empresa isolada por `companyId`,
  aplicado em todos os módulos de negócio. Um `SUPER_ADMIN` de plataforma
  gerencia a lista de empresas sem acessar os dados internos de nenhuma delas.
- **Multiunidade**: cada empresa pode ter várias unidades físicas (`Branch`),
  com endereço, contato e fluxo de publicação (só fica visível ao público
  depois que os dados obrigatórios são preenchidos).
- **Cadastro público inteligente**: um cliente pode se cadastrar sem precisar
  de link nenhum (escolhe empresa e unidade na hora) ou por link direto
  (`?empresa=slug&unidade=slug`).
- **API completa**: clientes, veículos, catálogo de serviços, agenda com
  detecção de conflito de horário/funcionário (considerando o fuso horário
  de cada empresa), ordens de serviço com baixa automática de estoque e
  lançamento financeiro, financeiro (fluxo de caixa, DRE), estoque,
  funcionários (escala/ponto/comissão), dashboard com KPIs.
- **Painel web** com login, dark/light mode e CRUD completo para cada módulo.
- **Home pública** com dados reais (serviços e unidades vindas da API, sem
  texto ou dado inventado — seções sem conteúdo configurado ficam ocultas).
- **PIX real**: geração de payload "copia e cola" no padrão EMV do Banco
  Central (escaneável de verdade). A confirmação de pagamento depende de um
  PSP real ou conciliação manual.
- **Notificações** por e-mail via SMTP real (modo *dry-run* quando não
  configurado).
- **IA**: sugestão determinística de horários livres e identificação de
  clientes VIP/inativos (sem depender de LLM), mais geração de mensagens via
  Claude quando `ANTHROPIC_API_KEY` está configurada, com fallback por
  template quando não está.
- **PWA + app Android**: instalável no navegador e publicado como app na
  Play Store via TWA, com política de privacidade própria (`/privacidade`).

## O que ainda não está implementado

Por exigirem contas/credenciais externas, decisões de produto ou serem o
tamanho de uma sprint própria:

- Identidade multiempresa completa (um mesmo login de cliente atendido por
  várias empresas diferentes) — hoje o cliente pertence a uma única empresa.
- Papéis adicionais de dono/administrador de empresa além dos atuais
  (`ADMIN`, `MANAGER` etc.) e painel de saúde da plataforma para o super admin.
- Login social (Google/Apple) — endpoints e schema prontos, UI não conectada.
- Integrações reais de Stripe, Mercado Pago, WhatsApp Business API e Firebase
  Push — adapters implementados, rodando em modo sandbox/mock (basta
  configurar as chaves em `.env` para ativar de verdade).
- Programas de fidelidade/cashback/cupom, OCR de placa/documento — schema
  básico existe (`LoyaltyAccount`, `Coupon`), lógica de negócio não
  implementada.
- Planos/assinaturas SaaS.

## Como rodar localmente

### Opção 1 — Docker Compose (recomendado)

```bash
cd autoprime
cp backend/.env.example backend/.env
docker compose up --build
```

- API: http://localhost:3001/api/v1 (Swagger em `/api/docs`)
- Painel web: http://localhost:3000
- Via NGINX (proxy único): http://localhost

Depois de subir, rode as migrations e o seed dentro do container do backend:

```bash
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npm run prisma:seed
```

### Opção 2 — Sem Docker

Requer Node 22+, PostgreSQL 16+ e Redis (opcional nesta entrega).

```bash
# Backend
cd autoprime/backend
cp .env.example .env   # ajuste DATABASE_URL para seu Postgres local
npm install
npx prisma migrate dev
npm run prisma:seed
npm run start:dev

# Web (em outro terminal)
cd autoprime/web
cp .env.local.example .env.local
npm install
npm run dev
```

## Credenciais de teste (seed)

| Perfil        | E-mail                     | Senha          |
|---------------|----------------------------|----------------|
| Super admin   | superadmin@autoprime.app   | SuperAdmin@123 |
| Administrador | admin@autoprime.app        | Admin@123      |
| Gerente       | gerente@autoprime.app      | Manager@123    |
| Lavador       | lavador@autoprime.app      | Washer@123     |
| Detalhador    | detalhador@autoprime.app   | Detailer@123   |
| Cliente       | cliente@autoprime.app      | Cliente@123    |

**Importante**: essas senhas são públicas (estão neste arquivo). O seed
(`npm run prisma:seed`) é um comando **manual**, só para desenvolvimento ou
para provisionar um ambiente novo — o `Dockerfile` de produção nunca roda o
seed sozinho no boot. Se algum ambiente real usar esses e-mails, troque a
senha imediatamente.

## Testes

```bash
cd autoprime/backend
npm test          # testes unitários (auth, agenda, OS, financeiro, IA, PIX, branches...)
npm run test:e2e  # testes end-to-end contra um Postgres real
```

O e2e usa por padrão `postgresql://autoprime:autoprime@localhost:5432/autoprime_test`
(sobrescreva com `TEST_DATABASE_URL`). Rode as migrations nesse banco antes:

```bash
DATABASE_URL=postgresql://autoprime:autoprime@localhost:5432/autoprime_test?schema=public npx prisma migrate deploy
```

## Publicando externamente

Quer colocar o AP Auto Prime no ar com uma URL pública? Siga
[`docs/DEPLOY_RAILWAY.md`](./docs/DEPLOY_RAILWAY.md) — passo a passo completo
usando Railway (Postgres + Redis + backend + web, HTTPS automático). Os
arquivos `railway.json` de `backend/` e `web/` já deixam o deploy praticamente
"apontar e clicar".

Para publicar o app Android na Play Store, siga
[`android-twa/README.md`](./android-twa/README.md).

## Documentação adicional

- [`docs/MANUAL_ADMINISTRADOR.md`](./docs/MANUAL_ADMINISTRADOR.md) — como usar o painel como administrador
- [`docs/MANUAL_USUARIO.md`](./docs/MANUAL_USUARIO.md) — como usar como cliente
- [`docs/DEPLOY_RAILWAY.md`](./docs/DEPLOY_RAILWAY.md) — deploy em produção
- [`android-twa/README.md`](./android-twa/README.md) — publicação na Play Store
- Swagger/OpenAPI interativo: `GET /api/docs` no backend em execução
