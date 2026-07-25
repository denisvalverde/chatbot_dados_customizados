# Publicando o AutoPrime no Railway

Guia passo a passo para colocar o AutoPrime no ar publicamente usando o
[Railway](https://railway.app). Você vai ter 4 serviços dentro de um mesmo
projeto: PostgreSQL, Redis, API (backend) e Painel (web).

## 1. Criar a conta

1. Acesse https://railway.app e clique em **Login** → **Login with GitHub**
   (recomendado — facilita conectar o repositório depois).
2. Autorize o Railway a acessar sua conta do GitHub.

## 2. Criar o projeto e conectar o repositório

1. No dashboard, clique em **New Project** → **Deploy from GitHub repo**.
2. Selecione `denisvalverde/chatbot_dados_customizados`.
3. Se pedir permissão de acesso ao repositório, autorize.
4. Railway vai tentar criar um serviço automaticamente a partir da raiz do
   repositório — pode **deletar esse serviço inicial**, vamos criar os 4
   serviços manualmente para apontar cada um para a pasta certa (é um
   monorepo).

## 3. Adicionar o banco de dados (PostgreSQL)

1. Dentro do projeto, clique em **+ New** → **Database** → **Add PostgreSQL**.
2. Pronto — o Railway cria a variável `DATABASE_URL` automaticamente dentro
   desse plugin. Você vai referenciar essa variável no serviço do backend
   (passo 5).

## 4. Adicionar o Redis

1. Clique em **+ New** → **Database** → **Add Redis**.
2. O Railway cria a variável `REDIS_URL` automaticamente.

## 5. Criar o serviço do backend (API)

1. Clique em **+ New** → **GitHub Repo** → selecione o mesmo repositório de
   novo.
2. Abra o serviço criado → aba **Settings**:
   - **Root Directory**: `autoprime/backend`
   - **Build**: deixe em "Dockerfile" (o Railway detecta o `Dockerfile` e o
     `railway.json` já incluídos nessa pasta).
3. Aba **Variables**, adicione (clique em "New Variable" para cada uma):

   | Nome | Valor |
   |---|---|
   | `DATABASE_URL` | Clique em "Add Reference" → escolha o plugin Postgres → `DATABASE_URL` |
   | `REDIS_URL` | Referência ao plugin Redis → `REDIS_URL` |
   | `PORT` | `3001` |
   | `JWT_ACCESS_SECRET` | gere um valor aleatório forte (ex.: `openssl rand -hex 32`) |
   | `JWT_REFRESH_SECRET` | outro valor aleatório forte, diferente do anterior |
   | `WEB_URL` | (preencha depois de criar o serviço web, passo 7) |

   Variáveis opcionais (só se for usar de verdade — sem elas, o sistema roda
   em modo sandbox/mock, sem quebrar nada):
   `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`,
   `STRIPE_SECRET_KEY`, `MERCADO_PAGO_ACCESS_TOKEN`, `PIX_KEY`,
   `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `FIREBASE_SERVER_KEY`,
   `ANTHROPIC_API_KEY`.

4. Aba **Settings** → **Networking** → **Generate Domain**. Isso cria uma URL
   pública tipo `autoprime-backend-production.up.railway.app`. Anote essa URL.
5. Faça o deploy (o Railway já dispara automaticamente após salvar). As
   migrations do banco rodam sozinhas no boot — o `Dockerfile` já executa
   `npx prisma migrate deploy` antes de subir o servidor.

## 6. Popular dados de exemplo (opcional)

Para ter usuários/serviços de teste, instale a CLI do Railway na sua máquina
e rode o seed uma vez:

```bash
npm install -g @railway/cli
railway login
railway link         # selecione o projeto e o serviço "backend"
railway run npm run prisma:seed
```

## 7. Criar o serviço do painel web

1. Clique em **+ New** → **GitHub Repo** → mesmo repositório de novo.
2. **Settings** → **Root Directory**: `autoprime/web`.
3. Aba **Variables**:

   | Nome | Valor |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | `https://<url-do-backend-do-passo-5>/api/v1` |

   Como o Next.js "queima" essa variável dentro do build, ela precisa estar
   disponível **como build argument**. O `Dockerfile` já declara
   `ARG NEXT_PUBLIC_API_URL`, e o Railway repassa as variáveis do serviço
   como build args automaticamente para builds via Dockerfile. Se depois do
   deploy o painel continuar chamando `localhost`, confira em **Settings →
   Build** se existe uma seção específica de "Build Arguments" e adicione a
   variável lá também.

4. **Settings** → **Networking** → **Generate Domain**. Essa é a URL pública
   do seu painel (ex.: `autoprime-web-production.up.railway.app`).

## 8. Ajustar CORS (recomendado)

Por padrão a API aceita requisições de qualquer origem (`cors: true` em
`main.ts`), o que já funciona para publicar. Se quiser restringir por
segurança, edite `autoprime/backend/src/main.ts`:

```ts
const app = await NestFactory.create(AppModule, {
  cors: { origin: process.env.WEB_URL, credentials: true },
});
```

E defina a variável `WEB_URL` no serviço do backend com a URL do passo 7.

## 9. Pronto

Acesse a URL do painel web (passo 7) no navegador. Login de teste (se você
rodou o seed): `admin@autoprime.app` / `Admin@123`.

**Importante**: troque as senhas de exemplo e gere segredos JWT únicos antes
de usar isso com dados reais de clientes.

## Domínio próprio (opcional)

Em **Settings → Networking → Custom Domain** de cada serviço, você pode
apontar um domínio seu (ex.: `app.suaempresa.com.br`) via registro CNAME —
o Railway emite HTTPS automaticamente.
