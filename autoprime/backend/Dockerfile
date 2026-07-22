FROM node:22-alpine AS base
WORKDIR /app
RUN corepack disable
# O Prisma (query/schema engine) precisa do libssl para rodar — Alpine não
# vem com ele por padrão. Sem isso, o engine falha ao iniciar com um erro
# de linker que não é JSON válido, quebrando `prisma generate`/`migrate deploy`.
RUN apk add --no-cache openssl

FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json ./

EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main"]
