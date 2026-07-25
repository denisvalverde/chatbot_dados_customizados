# Production Readiness — AP Auto Prime

Checklist vivo contra os critérios de "pronto" da remodelagem. Atualizado a
cada etapa fechada (ver `docs/product-roadmap.md`).

| Critério | Status |
|---|---|
| Lint (backend/web) | ✅ verde |
| Typecheck/build (backend/web) | ✅ verde |
| Testes unitários backend (38) | ✅ verde |
| Testes E2E | ⚠️ existem, não executados neste ambiente (sem Postgres/Docker local) |
| Migrations aplicadas em produção | ✅ (`init`, `multi_tenant`, `company_timezone`) |
| Isolamento multiempresa | ✅ implementado; ⚠️ testes hoje só com Prisma mockado, não contra DB real |
| RBAC testado | ⚠️ parcial (guards existem; sem suite dedicada de autorização negativa) |
| Cliente cadastra-se / veículo / agenda | ✅ via painel interno; ❌ sem fluxo público próprio |
| Reagendar/cancelar | ✅ (API); ❌ sem UI de cliente |
| Histórico como comanda | ❌ não existe UI de cliente |
| Empresa com unidades (Branch) | ❌ não implementado |
| Planos/assinaturas/créditos | ❌ não implementado |
| Avaliações | ⚠️ schema existe, sem endpoint/UI |
| Feed | ❌ não implementado |
| Cupons | ⚠️ schema existe, sem lógica |
| Dados sensíveis não expostos | ✅ (`SanitizeResponseInterceptor`, CPF sem máscara automática ainda — pendente) |
| `/health`, `/health/ready` | ❌ não existem (só `/api/v1` raiz responde) |
| Deploy saudável | ✅ (ambos os serviços Railway `SUCCESS`, logs sem erro) |
| Documentação atualizada | ✅ (este conjunto de docs) |

## Como reproduzir a validação local
```bash
cd autoprime/backend && npm ci && npx prisma generate && npm run lint && npm run build && npm test
cd autoprime/web && npm ci && npm run lint && npm run build
```
E2E requer Postgres real (`docker compose up -d postgres redis` a partir de
`autoprime/`, depois `npm run test:e2e` no backend).
