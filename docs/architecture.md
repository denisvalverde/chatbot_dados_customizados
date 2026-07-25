# Arquitetura — AP Auto Prime

## Stack
Backend: NestJS 10 + Prisma 5 + PostgreSQL, JWT (access+refresh), RBAC via
guard/decorator, `@nestjs/throttler`, Luxon para timezone. Frontend:
Next.js 14 (App Router) + React 18 + Tailwind. Deploy: Railway, Docker,
duas apps/serviços a partir do mesmo repo (`autoprime/backend`,
`autoprime/web`).

## As três experiências (alvo desta remodelagem)

```
A. Pública/Cliente          B. Operacional da empresa     C. Plataforma SaaS
   /                            dashboard, agenda,            platform/dashboard
   /empresa/[slug]              clientes, comandas,           platform/companies
   /empresa/[slug]/agendar      financeiro, estoque,          platform/plans
   cliente/*                    equipe, configuracoes         platform/audit
   (público + login CLIENT)     (login staff: ADMIN/          (login SUPER_ADMIN)
                                 MANAGER/EMPLOYEE/...)
```

Cada uma é um grupo de rotas Next.js com layout próprio (`(public)`,
`(dashboard)` já existe, `(platform)` novo), sem overlap de navegação. O
backend não muda de estrutura para isso — os três ambientes já consomem a
mesma API REST versionada (`/api/v1`), diferenciados por role no JWT.

## Isolamento multi-tenant (já implementado, ver `docs/audit.md` §2)
`companyId` nunca aceito do corpo da requisição — vem de
`@CompanyId()` (lido de `request.user.companyId`, que vem do JWT validado
em `JwtStrategy`). `SUPER_ADMIN` tem `companyId` nulo e só acessa
`/companies/*`. `ValidationPipe` global com `forbidNonWhitelisted: true`
impede mass assignment de campos não declarados no DTO (inclusive
`companyId`).

## Módulos de domínio (backend, por pasta em `src/`)
`auth`, `company`, `clients`, `vehicles`, `catalog` (serviços),
`scheduling` (agenda), `service-orders` (comandas), `financial`,
`inventory`, `employees`, `dashboard`, `notifications`, `payments`, `ai`
(disponibilidade determinística + geração de texto via Claude opcional).
Novos módulos desta remodelagem: `branches`, `plans`/`subscriptions`,
`reviews`, `feed`, `coupons`, `platform` (agregando métricas cross-tenant
para `SUPER_ADMIN`).

## Frontend (`autoprime/web/src`)
`app/(public)/...` novo grupo para experiência A. `app/(dashboard)/...`
existente, experiência B. `app/(platform)/...` novo grupo, experiência C.
`lib/` compartilhado (`api.ts`, `auth.ts`, `datetime.ts`,
`company-context.tsx`, `types.ts`). `components/ui` design system
compartilhado entre os três grupos.
