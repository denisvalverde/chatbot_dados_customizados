# Plataforma de IA — Suporte Técnico, SRE e Infraestrutura

Plataforma completa para apoiar operações de suporte técnico, SRE e infraestrutura:
classificação híbrida de chamados, extração de entidades técnicas, motor de análise
com salvaguardas anti-alucinação, RAG sobre uma base de conhecimento própria, geração
de comunicação profissional (GMUD, RCA, planos de ação, respostas a clientes), rede
neural PyTorch multi-tarefa e uma API REST completa com segurança, observabilidade e
MLOps.

**Funciona 100% offline por padrão** — sem exigir chave de LLM, Postgres ou Redis.

---

## 1. Resumo da solução

- **Backend**: FastAPI + SQLAlchemy 2 + Alembic, arquitetura em camadas (api → services
  → infrastructure/domain), SQLite local por padrão / PostgreSQL+pgvector em produção.
- **Classificação híbrida**: regras determinísticas (sempre disponíveis) + rede neural
  PyTorch (quando treinada) + busca de similaridade na base histórica, fundidas por
  voto ponderado com confiança explícita.
- **Motor de análise anti-alucinação**: separa fatos (com evidência objetiva) de
  hipóteses (com confiança e evidências favoráveis/contrárias), nunca afirma causa raiz
  sem evidência, lista informações ausentes e riscos.
- **RAG**: embeddings locais (hashing determinístico, sem download) por padrão, com
  adapters para Sentence Transformers e OpenAI; vector store local (NumPy) com adapter
  para PostgreSQL+pgvector; reranking multi-critério; LLM plugável (local/OpenAI/
  Anthropic/mock-apenas-teste).
- **Rede neural**: MLP multi-head (tronco compartilhado + bloco residual) com 5 saídas
  multiclasse (categoria, subcategoria, severidade, equipe, risco) e 1 saída multilabel
  (tecnologias), treino com early stopping, class weights, gradient clipping, scheduler,
  métricas completas e exportação ONNX.
- **UI**: SPA leve (HTML/CSS/JS puro, sem build step) servida pelo próprio FastAPI,
  consumindo exclusivamente a API real — dashboard, nova análise, chamados, base de
  conhecimento, ML.
- **Segurança**: JWT + RBAC (admin/analyst/viewer), rate limiting, redaction automática
  de segredos/PII, auditoria, proteção contra prompt injection no RAG.
- **Observabilidade**: logs JSON estruturados com request-id/correlation-id, métricas
  Prometheus (`/metrics`), `/health` e `/ready`.
- **Testes**: 45 testes (unit/api/ml), **87% de cobertura** (meta: 80%).

## 2. Arquitetura implementada

```
backend/
├── app/
│   ├── main.py                 # FastAPI app, middleware, observabilidade
│   ├── core/                   # config, logging, security (JWT/RBAC), exceptions
│   ├── domain/enums.py         # vocabulários controlados (categorias, severidade...)
│   ├── schemas/api.py          # DTOs Pydantic v2 de entrada/saída
│   ├── infrastructure/
│   │   ├── database.py, models.py, repositories.py
│   │   ├── embeddings.py       # LocalHashingEmbedder | SentenceTransformers | OpenAI
│   │   ├── vector_store.py     # LocalVectorStore (NumPy) | PgVectorStore
│   │   └── llm.py              # LocalLLMProvider | OpenAI | Anthropic | Mock(teste)
│   ├── services/
│   │   ├── redaction.py, entity_extraction.py, rules.py
│   │   ├── commands.py         # catálogo de comandos seguros por categoria
│   │   ├── communication.py    # templates por tipo/público
│   │   ├── classification.py   # fusão híbrida (regras + rede + similaridade)
│   │   ├── analysis.py         # motor de análise anti-alucinação
│   │   └── rag.py              # ingestão, busca, reranking, geração
│   ├── ml/
│   │   ├── network.py          # MultiHeadTicketClassifier (PyTorch)
│   │   ├── dataset.py          # esquema + gerador sintético identificado
│   │   ├── train.py, infer.py
│   ├── api/v1/endpoints/       # auth, tickets, ai, knowledge, feedback, models
│   └── static/                 # UI (index.html, app.js, styles.css)
├── migrations/                 # Alembic (+ pgvector.sql opcional)
├── scripts/                    # seed, build_dataset, train_nn, import_dataset
├── tests/{unit,api,ml}/
├── docs/api-examples.http      # coleção de exemplos de requisições
├── Dockerfile, docker-compose.yml, Makefile, .env.example
```

### Fluxo principal

```
Usuário → POST /api/v1/tickets (classificação automática)
       → POST /api/v1/analyze  (fatos, hipóteses, riscos, comandos, escalonamento)
       → POST /api/v1/generate-response|gmud|rca|action-plan|timeline
       → POST /api/v1/feedback (aprendizado contínuo)
```

## 3. Funcionalidades entregues

Todas as 23 capacidades da seção 1 da especificação foram implementadas: classificação
automática, identificação de produto/tecnologia, severidade/urgência/impacto/risco,
extração de entidades, detecção de sintomas/hipóteses/evidências, recomendação de
diagnóstico, geração de comandos seguros, análises técnicas, respostas profissionais,
atualizações internas, planos de ação, RCA, cronologias, GMUDs, encerramentos, consulta
à base histórica, aprendizado via feedback, casos similares, informações ausentes,
confiança por recomendação, separação fato/hipótese/recomendação, e bloqueio de
conclusões sem evidência suficiente.

Os domínios técnicos da seção 2 (hardware/iLO/iDRAC, RAID/MegaRAID, virtualização
Proxmox/KVM/VMware, Linux, redes, object storage S3, backup PBS/Acronis, DDoS) estão
cobertos no dicionário de regras (`services/rules.py`), no catálogo de comandos
(`services/commands.py`) e no dataset sintético (`ml/dataset.py`).

## 4. Rede neural implementada

`MultiHeadTicketClassifier` (PyTorch): embedding textual → `Linear → LayerNorm → GELU →
Dropout → ResidualBlock` → 6 cabeças (`categoria`, `subcategoria`, `severidade`,
`equipe`, `risco` multiclasse + `tecnologias` multilabel).

Treino (`app/ml/train.py`): split estratificado 70/15/15 com fallback automático para
datasets pequenos, class weights por cabeça, `AdamW`, `ReduceLROnPlateau`, gradient
clipping, early stopping, checkpoint do melhor modelo, métricas completas (accuracy,
precision/recall/F1 macro, matriz de confusão, F1-micro multilabel), exportação ONNX.

**Dataset**: o repositório inclui um gerador **sintético claramente identificado**
(`app/ml/dataset.py::generate_synthetic_dataset`, campo `"origem": "sintetico"` em cada
registro). Todo modelo treinado só com esses dados é marcado com
`is_production_ready: false` e um aviso explícito é retornado pela API — o baseline
determinístico (regras) permanece a fonte principal na fusão até haver dados reais em
volume suficiente (`scripts/import_dataset.py` importa CSV/JSONL reais).

## 5. Pipeline RAG implementado

```
texto → normalização → embedding → busca vetorial (top-N amplo)
      → filtro por categoria/tipo/aprovação → reranking multi-critério
      → contexto (top-K) → geração (LLM configurado ou fallback local)
      → validação anti-alucinação → confiança
```

Reranking pondera similaridade (55%), categoria (15%), tecnologia (10%), taxa de
sucesso da solução (10%), recência (5%) e aprovação (5%). A validação de saída rejeita
afirmações de causa raiz/resolução/estabilidade sem documento de suporte, reduzindo a
confiança reportada.

## 6. APIs criadas

Todos os 21 endpoints da especificação (seção 8), incluindo `/health`, `/ready`,
`/metrics`. Ver `docs/api-examples.http` para exemplos prontos de cada um.

## 7. Testes executados

```
python -m pytest tests/ -v     → 45 passed
python -m coverage report      → 87% (meta: 80%)
python -m ruff check app scripts tests → All checks passed
```

Cobrem: regras determinísticas, extração de entidades (IPs/hosts/VLANs/RAID/discos/
comandos), redaction de segredos, motor de análise (fato vs. hipótese, escalonamento),
catálogo de comandos (nenhum destrutivo é gerado), templates de comunicação por
público, embeddings/similaridade, RAG (ingestão + busca + redaction), providers LLM
(incluindo a trava do `MockProvider` fora de `ENVIRONMENT=test`), rede neural (forward,
shapes, treino mínimo real, inferência), dataset (validação Pydantic, marcação
sintética), e API completa (auth, RBAC 403, CRUD de tickets, análise, conhecimento,
feedback, modelos).

## 8. Como executar

### Localmente (sem Docker)

```bash
cd backend
make install                 # cria .venv, instala torch (CPU) + dependências
cp .env.example .env         # ajuste JWT_SECRET_KEY em produção
make migrate                 # aplica as migrations (SQLite local por padrão)
make seed                    # cria usuário admin (senha impressa uma vez) + demo
make dev                     # sobe em http://localhost:8000 (UI em "/")
```

### Com Docker Compose (Postgres + pgvector + Redis + API)

```bash
cd backend
cp .env.example .env         # defina POSTGRES_PASSWORD e JWT_SECRET_KEY
make docker-up                # ou: docker compose up -d --build
# API em http://localhost:8000 ; migrations + seed rodam automaticamente no start
```

### Testes e qualidade

```bash
make test     # pytest -v
make lint     # ruff check
make format   # ruff check --fix
```

## 9. Como treinar o modelo

```bash
make train
# equivalente a:
#   python scripts/build_dataset.py --rows 1500   (dataset SINTETICO, ver aviso)
#   python scripts/train_nn.py --epochs 20
```

Ou via API (após login): `POST /api/v1/models/train {"epochs": 20}`. O checkpoint é
salvo em `app/ml/artifacts/multihead_best.pt`, o ONNX em `multihead.onnx`, e uma versão
é registrada em `GET /api/v1/models`. Para promover uma versão: `POST
/api/v1/models/deploy?model_version_id=<id>`.

## 10. Como importar a base histórica (dados reais)

```bash
# CSV com colunas: texto,categoria[,subcategoria,severidade,equipe,risco,tecnologias]
python scripts/import_dataset.py meus_chamados.csv --output datasets/tickets_real.jsonl

# Ou anexar ao dataset sintético existente (mistura real+sintético, mantendo a origem):
python scripts/import_dataset.py meus_chamados.jsonl --append datasets/tickets_synthetic.jsonl

# Treinar com o dataset real:
python scripts/train_nn.py --dataset datasets/tickets_real.jsonl --epochs 30
```

Para a base de conhecimento (RAG), use `POST /api/v1/knowledge/ingest` com um lote de
documentos, ou `POST /api/v1/knowledge/documents` individualmente.

## 11. Como configurar um LLM externo (opcional)

Por padrão `LLM_PROVIDER=local` — a plataforma monta respostas estruturadas a partir do
contexto recuperado, sem inventar fatos, sem custo e sem rede externa.

Para enriquecer com um provedor externo, no `.env`:

```bash
LLM_PROVIDER=openai            # ou: anthropic
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

O prompt sempre separa **instruções** de **documentos** (`<documento>` como dados, nunca
como instrução) para mitigar prompt injection vindo da base de conhecimento.

Para embeddings semânticos (em vez do hashing local):

```bash
EMBEDDING_PROVIDER=sentence-transformers
# requer: pip install sentence-transformers
```

## 12. Limitações reais

- **Modelo neural**: treinado apenas com dados **sintéticos** neste repositório
  (`origem: sintetico`); a API sinaliza isso explicitamente (`is_production_ready:
  false`) e o baseline determinístico continua ponderado na fusão. Não representa
  desempenho de produção até haver dados reais.
- **Embeddings padrão** (`local-hashing`) são lexicais, não semânticos profundos —
  suficientes como baseline funcional offline, mas inferiores a um Sentence
  Transformer para sinônimos/paráfrases. Trocar via `EMBEDDING_PROVIDER` quando
  possível.
- **Vector store local** (NumPy em memória a cada busca) escala bem até dezenas de
  milhares de documentos; acima disso, usar `VECTOR_BACKEND=pgvector`.
- **Treino síncrono**: `POST /models/train` bloqueia a requisição durante o treino
  (aceitável com o dataset atual, segundos). Com datasets grandes, mover para
  worker assíncrono (Celery/Dramatiq — dependência já prevista no `requirements.txt`
  comentado).
- **Rate limiting em memória por processo**: adequado para um único worker; com múltiplos
  workers/réplicas, mover para Redis (já disponível no compose).
- **OCR/PDF/imagens**: a especificação pede aceitar PDF/imagens como entrada; o MVP
  aceita texto/Markdown/JSON/CSV diretamente nos campos da API. Extração de texto de
  PDF/OCR de imagens não foi implementada nesta entrega (ver próximos passos).
- **OpenTelemetry/Grafana/Loki**: não implementados nesta entrega; a base (logs JSON
  + métricas Prometheus) está pronta para alimentá-los.
- **MyPy**: não incluído na validação automatizada desta entrega (Ruff cobre lint);
  o código usa type hints extensivamente mas não foi validado com checagem estrita.

## 13. Próximos passos

1. Treinar com dados reais (`scripts/import_dataset.py`) e promover o modelo via
   `/models/deploy` quando `is_production_ready: true`.
2. Adicionar extração de texto de PDF/OCR de imagens como evidência.
3. Mover treino e ingestão em lote para workers assíncronos (Celery/Dramatiq + Redis).
4. Adicionar OpenTelemetry tracing e stack Grafana/Loki para observabilidade completa.
5. Habilitar MLflow (`pip install mlflow`) para comparação de experimentos entre
   versões do modelo.
6. Adicionar detecção de drift comparando a distribuição de classes do tráfego real
   contra o dataset de treino.
7. Expandir RBAC com grupos/permissões granulares por categoria/equipe.
8. Integrar Next.js/shadcn como frontend completo, caso a SPA leve atual seja
   insuficiente para o volume de usuários (a API já está pronta para qualquer cliente).
