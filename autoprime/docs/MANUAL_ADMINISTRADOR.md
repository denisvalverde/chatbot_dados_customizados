# Manual do Administrador — AutoPrime

## 1. Acesso

Acesse o painel web (`/login`) com um usuário de perfil **Administrador** ou
**Gerente**. As credenciais de exemplo (ambiente de desenvolvimento, criadas pelo
seed) estão no `README.md` do projeto.

## 2. Criando funcionários e outros administradores

Não há tela de cadastro de equipe no painel web nesta entrega (ver roadmap). Use o
endpoint da API diretamente (Swagger em `/api/docs`, seção `auth`):

```
POST /api/v1/auth/staff
Authorization: Bearer <token de admin/gerente>

{
  "name": "Nome do funcionário",
  "email": "email@autoprime.app",
  "password": "SenhaForte123",
  "role": "WASHER",           // ADMIN | MANAGER | EMPLOYEE | WASHER | DETAILER | FINANCE
  "position": "Lavador"
}
```

## 3. Catálogo de serviços

Menu **Catálogo de Serviços** → "+ Novo serviço". Defina nome, categoria, preço,
duração estimada (usada para calcular o fim do agendamento automaticamente) e
quantidade de funcionários necessários. Checklist e produtos utilizados por serviço
podem ser definidos via API (`POST /api/v1/services`, campos `checklist` e
`products`) — a tela web cobre os campos principais.

## 4. Agenda

Menu **Agenda**. Ao criar um agendamento, selecione cliente, veículo e um ou mais
serviços — a duração final é a soma das durações dos serviços escolhidos. O sistema
**rejeita automaticamente** um agendamento se um funcionário selecionado já estiver
alocado em outro atendimento que se sobreponha ao horário.

## 5. Ordens de Serviço (OS)

Uma OS pode ser criada a partir de um agendamento (via API `POST /service-orders`
com `appointmentId`) ou avulsa. O fluxo de status é:
`OPEN → IN_PROGRESS → COMPLETED → DELIVERED`.

Ao **concluir** uma OS (`PATCH /service-orders/:id/complete`, botão "Concluir" no
painel), o sistema automaticamente:

1. Dá baixa no estoque dos produtos vinculados aos serviços da OS.
2. Lança a receita correspondente no financeiro.

Isso acontece dentro de uma transação de banco — se qualquer etapa falhar, nada é
alterado.

## 6. Financeiro

Menu **Financeiro** mostra fluxo de caixa dos últimos 30 dias e permite lançamentos
manuais (receita/despesa). O endpoint `GET /financial/dre?from=...&to=...` calcula
margem líquida sobre um período arbitrário.

## 7. Estoque

Menu **Estoque**: cadastro de produtos com quantidade mínima. Produtos abaixo do
mínimo aparecem com o selo "Estoque baixo". Movimentações manuais de entrada/saída
via `POST /inventory/products/:id/movements`.

## 8. Funcionários

Menu **Funcionários**: lista da equipe, check-in/check-out de ponto. Cálculo de
comissão mensal via `POST /employees/:id/commission/:referenceMonth` (ex.:
`2026-07`), com base no faturamento das OS concluídas naquele mês multiplicado pela
`commissionRate` do funcionário.

## 9. Módulo de IA

Endpoints em `/api/v1/ai` (uso interno/API, sem tela dedicada nesta entrega):

- `GET /ai/suggest-slots?date=2026-08-01&durationMinutes=60` — horários livres reais,
  calculados a partir da agenda existente (sem depender de IA generativa).
- `GET /ai/vip-clients` / `GET /ai/inactive-clients` — segmentação de clientes.
- `POST /ai/generate-message` — gera mensagens de comunicação. Usa a API da
  Anthropic se `ANTHROPIC_API_KEY` estiver configurada no `.env`; caso contrário,
  usa um template determinístico (a funcionalidade nunca fica indisponível).

## 10. Segurança e auditoria

Toda operação de escrita (POST/PUT/PATCH/DELETE) é registrada em `AuditLog` com
usuário, IP e corpo da requisição (com senhas/tokens mascarados). Tokens de acesso
expiram em 15 minutos; o refresh token dura 7 dias e é revogado a cada uso.
