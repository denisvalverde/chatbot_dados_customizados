# Auditoria de Produto — AP Auto Prime (remodelagem profissional)

> Complementa `docs/audit.md` (segurança/técnica). Aqui: apenas o que é
> necessário para planejar as 10 etapas da remodelagem. Branch:
> `feature/autoprime-professional-remodel`, a partir de
> `claude/autoprime-complete-system-reveaf` (branch em produção).

## Frontend hoje — inventário real

**Rotas existentes** (`autoprime/web/src/app`): `/` (redirect para
`/dashboard` ou `/login`), `/login`, `/cadastro`, e `(dashboard)/*`
(dashboard, agenda, clientes, veículos via clientes, serviços, financeiro,
estoque, funcionários, ordens de serviço) — um único painel operacional
interno, sem separação por papel além de esconder itens do menu.

**Não existe nenhuma:** página pública por empresa (`/empresa/[slug]`),
área do cliente (`/cliente/*`), stepper de autoagendamento público, painel
da plataforma SaaS (`platform/*`). O backend já suporta parte disso
(`GET /companies/by-slug/:slug`, cadastro público com `?empresa=slug`,
`POST/GET /companies`, `PATCH /companies/:id/active` para `SUPER_ADMIN`) mas
nenhuma tela consome. Isto é a maior lacuna do pedido — é construção nova,
não retrofit.

**Já existe e deve ser preservado:** tokens de cor (`tailwind.config.ts`:
`graphite` + `primary` azul + semânticas success/warning/danger — já bate
com a identidade pedida), dark/light mode com persistência (`ThemeToggle`),
componentes base (`Button`, `Card`, `Badge`, `Input`/`Label`/`Select`,
`Modal`, `PageHeader`, `StatCard`, `Table`), Sidebar com navegação filtrada
por role, PWA configurado (para o painel interno).

## Modelos de domínio: pedido vs. schema atual

| Pedido | Estado |
|---|---|
| Company | ✅ (com `timezone`) |
| Branch | ❌ empresa é unidade única hoje |
| Membership | ⚠️ `User.companyId` direto (1 empresa por usuário) |
| CustomerAccount | ⚠️ equivalente é `Client` (1:1 com `User`) |
| Vehicle, Employee | ✅ |
| EmployeeSkill, ServiceCategory (tabela), WorkBay/Resource | ❌ |
| BusinessHours, BlockedPeriod | ❌ (expediente é constante fixa no código) |
| Appointment/AppointmentItem, WorkOrder/WorkOrderItem | ✅ (`Appointment`/`ServiceOrder`) |
| Payment | ✅ |
| Review | ⚠️ schema existe, sem controller/service |
| FeedPost, NotificationPreference | ❌ |
| Plan/Subscription/... | ❌ |
| AuditLog | ✅ em uso |

## Conclusão

Backend sólido no que já implementa. O gap do pedido é majoritariamente
**front-of-house** (nada de público/cliente existe) mais um conjunto de
domínios comerciais novos (Branch, Plan/Subscription, Review endpoints,
Feed, Cupom com lógica). Ver `docs/product-roadmap.md` para sequência.
