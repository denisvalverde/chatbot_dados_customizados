# Roadmap — Remodelagem Profissional AP Auto Prime

Baseado em `docs/product-audit.md`. Ordem de execução segue as 10 etapas
verticais pedidas; prioridade de risco/segurança classificada P0–P3.

## P0 — Segurança e falhas críticas
- ~~JWT secrets em produção~~ — feito.
- ~~Seed automático em produção~~ — feito.
- ~~Fuso horário~~ — feito.
- Testes automatizados de isolamento multi-tenant contra Postgres real
  (hoje só há unit tests com Prisma mockado — provam a *intenção* do
  código, não o comportamento real de ponta a ponta).

## P1 — Fluxos essenciais do negócio (ETAPAS 1–5)
1. Design system formalizado + navegação (ETAPA 1).
2. Página pública `/empresa/[slug]` + autoagendamento (ETAPA 2).
3. Cadastro/perfil/PWA do cliente (ETAPA 3).
4. `Branch` (multiunidade) (ETAPA 4).
5. Agenda profissional (views) + comandas no tablet/celular (ETAPA 5).

## P2 — CRM e experiência profissional (ETAPAS 6–8)
6. Cliente 360 + segmentação (ETAPA 6).
7. Plan/Subscription/crédito transacional (ETAPA 7).
8. Review (endpoints), FeedPost, Coupon/LoyaltyAccount com lógica real
   (ETAPA 8).

## P3 — Automação, crescimento e escala (ETAPAS 9–10)
9. Dashboards operacional/gerencial/SaaS, relatórios, `platform/*` (ETAPA 9).
10. `/health`+`/health/ready`, observabilidade, RLS (avaliação), E2E
    completo, LGPD (exportação/anonimização) (ETAPA 10).

## Regra de sequenciamento
Cada etapa fecha com: migration (se houver) → implementação → testes →
lint/typecheck/build → commit próprio → relatório. Deploy só depois de
verde. Nenhuma etapa deve remover algo que já funciona (dashboard interno
atual continua operando durante toda a remodelagem).
