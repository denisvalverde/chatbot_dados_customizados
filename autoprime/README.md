# AutoPrime

Plataforma de gestão para lava-rápido, estética automotiva e detail: agendamento,
ordens de serviço, financeiro, estoque, equipe e um painel administrativo premium.

Este diretório contém um monorepo com duas aplicações:

```
autoprime/
├── backend/   # API REST (NestJS + Prisma + PostgreSQL)
├── web/       # Painel web (Next.js + Tailwind) — admin, financeiro, operação
├── infra/     # Configuração de infraestrutura (NGINX)
└── docs/      # Manuais de uso e administração
```

## Escopo desta entrega — o que é real e o que é roadmap

Este projeto foi construído para ser **funcional de ponta a ponta**, não uma maquete.
Tudo abaixo foi implementado, testado (unitário + e2e) e validado rodando de verdade
(migrações reais, servidor subindo, chamadas HTTP reais, telas reais no navegador):

- API completa (auth JWT + refresh + RBAC + 2FA TOTP, clientes, veículos, catálogo de
  serviços, agenda com detecção de conflito de horário/funcionário, ordens de serviço
  com baixa automática de estoque e lançamento financeiro, financeiro (fluxo de caixa,
  DRE), estoque, funcionários (escala/ponto/comissão), dashboard com KPIs e gráficos).
- Painel web com login, dark/light mode, e CRUD real para cada um dos módulos acima.
- Geração de payload PIX "copia e cola" real (padrão EMV do Banco Central — escaneável
  de verdade), mas a **confirmação de pagamento** depende de um PSP real ou conciliação
  manual, pois não há credenciais de um provedor de pagamento nesta entrega.
- Notificações por e-mail via SMTP real (com modo *dry-run* se não configurado).
- Módulo de IA com lógica determinística real (sugestão de horários livres,
  identificação de clientes VIP/inativos) e geração de mensagens via Claude quando
  `ANTHROPIC_API_KEY` está configurada — com fallback por template quando não está.

**Fora do escopo desta entrega** (por exigirem contas/credenciais externas ou meses de
trabalho adicional — ver detalhes na conversa que originou este projeto):

- Apps nativos iOS/Android publicáveis em loja (Flutter/React Native). O painel web é
  responsivo e funciona em qualquer navegador de celular; um app nativo é fase 2.
- Integrações reais de Stripe, Mercado Pago, WhatsApp Business API e Firebase Push —
  os adapters estão implementados com a arquitetura completa e rodam em modo
  sandbox/mock; basta configurar as chaves em `.env` para ativá-los de verdade.
- Login social (Google/Apple) — endpoints e schema prontos, UI ainda não conectada.
- Programas de fidelidade/cashback/cupom, multifilial (múltiplas unidades por
  empresa), OCR de placa/documento — schema básico existe (`LoyaltyAccount`,
  `Coupon`) mas a lógica de negócio não foi implementada. **Multiempresa
  (multi-tenant) já está implementado** desde 2026-07-25: cada empresa
  (`Company`) tem seus próprios clientes, veículos, serviços, agenda,
  comandas, financeiro e estoque, isolados por `companyId`.

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

Requer Node 22+, PostgreSQL 16+ e Redis (opcional para esta entrega).

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

| Perfil        | E-mail                    | Senha         |
|---------------|---------------------------|---------------|
| Administrador | admin@autoprime.app       | Admin@123     |
| Gerente       | gerente@autoprime.app     | Manager@123   |
| Lavador       | lavador@autoprime.app     | Washer@123    |
| Detalhador    | detalhador@autoprime.app  | Detailer@123  |
| Cliente       | cliente@autoprime.app     | Cliente@123   |

**Importante**: essas senhas são públicas (estão neste arquivo). O seed
(`npm run prisma:seed`) é um comando **manual**, só para desenvolvimento/
staging — o `Dockerfile` de produção não roda mais o seed automaticamente no
boot. Se algum ambiente real usar a empresa "AutoPrime Demo" ou qualquer um
desses e-mails, troque a senha imediatamente.

## Testes

```bash
cd autoprime/backend
npm test          # 19 testes unitários (auth, agenda, OS, financeiro, IA, PIX)
npm run test:e2e  # 8 testes end-to-end contra um Postgres real
```

O e2e usa por padrão `postgresql://autoprime:autoprime@localhost:5432/autoprime_test`
(sobrescreva com `TEST_DATABASE_URL`). Rode as migrations nesse banco antes:

```bash
DATABASE_URL=postgresql://autoprime:autoprime@localhost:5432/autoprime_test?schema=public npx prisma migrate deploy
```

## Arquitetura

- **Backend**: NestJS (módulos por domínio), Prisma ORM sobre PostgreSQL, JWT com
  access+refresh token (refresh armazenado com hash e revogação), RBAC via guard +
  decorator `@Roles`, rate limiting (`@nestjs/throttler`), log de auditoria em toda
  mutação, interceptor que remove campos sensíveis (hash de senha, segredo 2FA) de
  qualquer resposta, Swagger/OpenAPI em `/api/docs`.
- **Web**: Next.js App Router, Tailwind CSS com paleta grafite/azul premium, dark mode,
  componentes próprios (Button, Card, Table, Modal), gráficos com Recharts.
- **Banco de dados**: schema único (`prisma/schema.prisma`) cobrindo identidade,
  clientes/veículos, catálogo de serviços, agenda, ordens de serviço, financeiro,
  estoque, RH e notificações — com migrations versionadas.

## Publicando externamente

Quer colocar o AutoPrime no ar com uma URL pública (não só rodando na sua
máquina)? Siga [`docs/DEPLOY_RAILWAY.md`](./docs/DEPLOY_RAILWAY.md) — passo a
passo completo usando Railway (Postgres + Redis + backend + web, HTTPS
automático). Os arquivos `railway.json` de `backend/` e `web/` já deixam o
deploy praticamente "apontar e clicar".

## Documentação adicional

- [`docs/MANUAL_ADMINISTRADOR.md`](./docs/MANUAL_ADMINISTRADOR.md)
- [`docs/MANUAL_USUARIO.md`](./docs/MANUAL_USUARIO.md)
- [`docs/DEPLOY_RAILWAY.md`](./docs/DEPLOY_RAILWAY.md)
- Swagger/OpenAPI interativo: `GET /api/docs` no backend em execução.
