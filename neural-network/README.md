# Classificador de Chamados de Suporte — Rede Neural (PyTorch)

Solucao completa de IA para **classificacao multiclasse de chamados de suporte em portugues**
(categorias: `acesso`, `financeiro`, `hardware`, `outros`, `rede`, `software`), com pipeline de
dados, treinamento reprodutivel, avaliacao com graficos, API de inferencia (FastAPI) e Docker.

> **Nota sobre os dados**: este projeto inclui um **gerador de dados sinteticos**
> (`scripts/generate_sample_data.py`) baseado em templates com variacoes aleatorias, apenas para
> permitir a execucao inicial. As metricas obtidas com esses dados sao artificialmente altas
> (o problema sintetico e facilmente separavel). Substitua por dados reais em `data/raw/`
> mantendo o mesmo esquema (`texto`, `categoria`).

## Visao geral

```
CSV (texto, categoria)
   └─> validacao de esquema e limpeza (ausentes, duplicatas, outliers)
        └─> split estratificado treino/val/teste (antes de qualquer fit — sem data leakage)
             └─> TF-IDF (fit apenas no treino) + LabelEncoder
                  └─> MLP (PyTorch) com dropout + batch norm + early stopping
                       └─> artefatos: best_model.pt, last_model.pt, preprocessor.joblib
                            └─> API FastAPI: /health, /model-info, /predict, /predict-batch
```

## Arquitetura da rede

| Item | Escolha | Justificativa |
|---|---|---|
| Arquitetura | MLP (TF-IDF 5000 dims → 256 → 128 → 6 classes) | Para textos curtos vetorizados com TF-IDF, um MLP raso e competitivo e ordens de magnitude mais barato que transformers/RNNs. |
| Ativacao | ReLU | Padrao robusto para MLPs. |
| Regularizacao | Dropout 0.3 + BatchNorm + weight decay 1e-4 | Combate overfitting em vocabulario esparso. |
| Loss | CrossEntropyLoss | Classificacao multiclasse. |
| Otimizador | AdamW, lr 1e-3 | Convergencia rapida com weight decay desacoplado. |
| Scheduler | ReduceLROnPlateau (fator 0.5, paciencia 2) | Reduz lr quando a validacao estagna. |
| Batch size / epocas | 64 / ate 30 | Early stopping (paciencia 5) interrompe antes; no treino validado parou na epoca 27. |
| Extras | Gradient clipping 1.0, AMP se houver GPU CUDA, deteccao de NaN/Inf, checkpoints best/last com retomada | |

Tudo configuravel em `configs/config.yaml`.

## Estrutura do projeto

```
neural-network/
├── configs/config.yaml          # hiperparametros e caminhos
├── data/{raw,processed,sample}  # dados (gerados/gitignored)
├── artifacts/{models,metrics,plots}
├── notebooks/exploratory_analysis.ipynb
├── src/
│   ├── config.py                # YAML + Pydantic
│   ├── data/                    # loader, preprocessing, validation
│   ├── models/                  # neural_network, model_factory
│   ├── training/                # trainer, evaluator, callbacks
│   ├── inference/predictor.py
│   ├── api/                     # main, schemas, dependencies
│   └── utils/                   # logger, seed, exceptions
├── scripts/                     # generate_sample_data, train, evaluate, serve
├── tests/                       # 31 testes pytest
├── Dockerfile / docker-compose.yml
└── requirements.txt / pyproject.toml
```

## Pre-requisitos

- Python 3.11+ (3.12 recomendado; a imagem Docker usa 3.12)
- pip
- Docker (opcional)

## Instalacao

Antes de tudo, clone o repositorio e entre na pasta do projeto — todos os comandos
deste README devem ser executados a partir do diretorio `neural-network/`.

### Linux / macOS (bash)

```bash
git clone https://github.com/denisvalverde/chatbot_dados_customizados.git
cd chatbot_dados_customizados
git checkout claude/neural-network-template-f51unn   # ate o merge na branch principal
cd neural-network

# Ambiente virtual
python3 -m venv .venv
source .venv/bin/activate

# Dependencias (CPU)
pip install torch                  # ou: pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
```

### Windows (PowerShell)

O PowerShell 5.1 nao aceita `&&`; execute um comando por linha (ou separe com `;`).
Use `\` nos caminhos e ative o venv com o script `Activate.ps1`.

```powershell
# Escolha uma pasta de trabalho (NAO use C:\Windows\system32)
cd $HOME\Documents

git clone https://github.com/denisvalverde/chatbot_dados_customizados.git
cd chatbot_dados_customizados
git checkout claude/neural-network-template-f51unn   # ate o merge na branch principal
cd neural-network

# Ambiente virtual
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Se aparecer erro de politica de execucao ao ativar:
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
# e ative novamente.

# Dependencias (CPU)
pip install torch
pip install -r requirements.txt
```

> Dica (Windows): se `python` abrir a Microsoft Store em vez de executar, instale o
> Python de https://www.python.org/downloads/ (3.11+) marcando "Add python.exe to PATH",
> ou use `py -3.12` no lugar de `python`.

Depois da instalacao, os demais comandos sao iguais em todos os sistemas — no Windows,
troque `/` por `\` nos caminhos (ex.: `python scripts\train.py --data data\sample\tickets.csv`).

## Estrutura dos dados

CSV com duas colunas:

| Coluna | Tipo | Descricao |
|---|---|---|
| `texto` | string | Texto do chamado (5 a 1000 caracteres) |
| `categoria` | string | Rotulo da classe (ex.: `hardware`, `rede`, ...) |

O pipeline valida o esquema, remove ausentes/duplicatas/outliers de tamanho, descarta classes com
menos de 3 exemplos e registra todas as transformacoes em `artifacts/metrics/test_metrics.json`.

## Como gerar dados de exemplo (sinteticos)

```bash
python scripts/generate_sample_data.py --rows 3000
# saida: data/sample/tickets.csv (inclui ~2% de sujeira proposital p/ exercitar a validacao)
```

## Como treinar

```bash
python scripts/train.py --data data/sample/tickets.csv
# opcoes: --epochs N | --resume (retoma do ultimo checkpoint) | --config caminho.yaml
```

Saidas:
- `artifacts/models/best_model.pt`, `last_model.pt`, `preprocessor.joblib`
- `artifacts/metrics/test_metrics.json`
- `artifacts/plots/training_curves.png`, `confusion_matrix.png`
- `data/processed/{train,val,test}.csv`

## Como avaliar

```bash
python scripts/evaluate.py                     # usa data/processed/test.csv
python scripts/evaluate.py --data meu_teste.csv
```

## Como iniciar a API

```bash
python scripts/serve.py
# variaveis: API_HOST, API_PORT, MODELS_DIR, LOG_LEVEL
```

### Exemplos de curl (validados)

```bash
curl http://localhost:8000/health
# {"status":"ok","model_loaded":true}

curl http://localhost:8000/model-info

curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"text": "nao consigo fazer login no erp, minha senha foi bloqueada"}'
# {"prediction":"acesso","confidence":0.9999,...,"model_version":"1.0.0"}

curl -X POST http://localhost:8000/predict-batch \
  -H "Content-Type: application/json" \
  -d '{"texts": ["meu notebook nao liga desde ontem", "internet do setor comercial caindo toda hora"]}'
```

Documentacao interativa: `http://localhost:8000/docs`.

## Como executar com Docker

```bash
# Treinamento em container (gera dados sinteticos + treina; artefatos ficam no volume ./artifacts)
docker compose run --rm train

# API (requer artefatos treinados em ./artifacts/models)
docker compose up -d api
curl http://localhost:8000/health

# Variaveis: API_PORT (porta do host), LOG_LEVEL
```

## Como executar os testes

```bash
python -m pytest tests/ -v
# resultado validado: 31 passed
```

## Como utilizar GPU

1. Instale o PyTorch com CUDA: `pip install torch --index-url https://download.pytorch.org/whl/cu124`
   (ajuste `cu124` a sua versao de CUDA).
2. Nada mais e necessario: o `Trainer` detecta CUDA automaticamente e ativa mixed precision
   (configuravel em `training.mixed_precision` no `config.yaml`).

## Metricas obtidas (dados sinteticos)

Treino validado nesta maquina (CPU, ~2 s, early stopping na epoca 27/30):

| Metrica (teste) | Valor |
|---|---|
| Accuracy | 1.0000 |
| Precision (macro) | 1.0000 |
| Recall (macro) | 1.0000 |
| F1 (macro) | 1.0000 |
| ROC-AUC (OvR) | 1.0000 |

> Metricas perfeitas ocorrem porque os dados sinteticos derivam de templates com vocabulario
> quase disjunto entre classes. **Nao extrapole para dados reais.**

## Limitacoes conhecidas

- Dados de exemplo sao sinteticos e trivialmente separaveis; as metricas nao refletem produção.
- TF-IDF ignora ordem das palavras e nao generaliza para vocabulario fora do treino.
- Textos fora do dominio ainda recebem uma classe (nao ha rejeicao por baixa confianca).
- O `transform_texts` densifica a matriz TF-IDF; para vocabularios muito grandes considere manter esparsidade.
- Sem autenticacao/rate limiting na API (adicionar antes de exposicao publica).

## Proximas evolucoes

- Substituir TF-IDF+MLP por embeddings ou fine-tuning de um modelo tipo BERTimbau quando houver dados reais.
- Threshold de confianca com classe de rejeicao ("encaminhar para humano").
- MLflow habilitado por padrao (`pip install mlflow` + `mlflow.enabled: true` no config).
- CI (GitHub Actions) com lint + testes; monitoramento de drift em producao.
