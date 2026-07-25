# Design System — AP Auto Prime

## Princípio
Os tokens de cor e o dark mode **já existem e estão corretos** — não
reinventar. O trabalho desta etapa é: formalizar o que já existe, preencher
os componentes que faltam, e documentar para uso consistente nas três
experiências (pública, operacional, plataforma).

## Tokens (`autoprime/web/tailwind.config.ts`)

| Token | Uso |
|---|---|
| `graphite.50…950` | Fundo e texto neutro (grafite profundo no dark mode) |
| `primary.50…700` (azul) | Ações primárias, links, destaque de marca |
| `success` / `warning` / `danger` | Estados semânticos (nunca usar cor fora dessas para status) |
| `boxShadow.glass` | Elevação de cards/modais em vidro fosco |
| `fontFamily.sans` (Inter) | Tipografia única do produto |

Modo escuro via `darkMode: 'class'` + `ThemeToggle` (persistência em
cookie/localStorage já implementada). Toda cor de fundo/texto deve ter par
`dark:` — nunca cor fixa sem variante.

## Componentes — inventário

**Existentes** (`components/ui/`): `Button`, `Card`, `Badge`, `Input`
(+`Label`,`Select`), `Modal`, `PageHeader`, `StatCard`, `Table`
(+`Thead`,`Th`,`Tr`,`Td`).

**A criar nesta remodelagem** (ordem de necessidade real, não a lista toda
de uma vez): `Skeleton` e `EmptyState` (todo fetch precisa de
loading/vazio), `Toast` (feedback de ação — hoje só há `setError` inline),
`ConfirmDialog` (ações destrutivas como cancelar/excluir), `Tabs` (Cliente
360, configurações), `Stepper` (autoagendamento), `TimeSlot` (grade de
horários manhã/tarde/noite), `Avatar`, `Pagination`, `Breadcrumb`,
`IconButton`. `Combobox`/`DataGrid`/`CommandMenu`/`Drawer`/`Sheet` ficam
para quando a etapa correspondente precisar deles de verdade — criar sem
uso real vira código morto.

## Regras
- Todo componente interativo tem estados `disabled`/`loading`/`error`/
  `success` explícitos — nunca um `<div>` genérico fingindo botão.
- Foco visível obrigatório (`focus-visible:ring-2 ring-primary-500`).
- Labels sempre associadas a input (`htmlFor`/`id` ou `aria-label`).
- Mobile-first: layout testado em 375px antes de qualquer breakpoint maior.
- Nenhuma cor "solta" fora dos tokens acima — se precisar de uma cor nova,
  ela entra no `tailwind.config.ts` primeiro.
