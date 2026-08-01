# chatbot_dados_customizados

Este repositório contém quatro projetos:

- **[`autoprime/`](./autoprime/README.md)** — AutoPrime, plataforma completa de
  gestão para lava-rápido, estética automotiva e detail (API NestJS + painel
  Next.js). Veja o README do projeto para instruções de instalação, execução,
  testes e escopo detalhado.
- **[`backend/`](./backend/README.md)** — Plataforma de IA para suporte técnico,
  SRE e infraestrutura: classificação híbrida de chamados (regras + rede neural
  PyTorch + similaridade), extração de entidades, análise técnica com
  salvaguardas anti-alucinação, RAG sobre base de conhecimento própria, geração
  de comunicação (GMUD, RCA, planos de ação) e API FastAPI completa com
  segurança, observabilidade e MLOps. Funciona 100% offline por padrão.
- **[`neural-network/`](./neural-network/README.md)** — classificador de chamados
  de suporte (TF-IDF + MLP em PyTorch), projeto standalone mais simples usado
  como base para o `backend/`. Inclui API própria, scripts de treino/inferência
  e visualização da arquitetura.
- **[`legacy-streamlit-app/`](./legacy-streamlit-app/README.md)** — demo Streamlit
  anterior, mantido apenas como referência histórica.
