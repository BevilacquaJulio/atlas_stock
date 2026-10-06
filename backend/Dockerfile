# syntax=docker/dockerfile:1
# Targets usados pelo pipeline (.github/workflows/ci.yml e cd.yml):
#   runtime → roda a API (só deps de produção)
#   migrate → roda "prisma migrate deploy" e sai (serviço migrate do compose)
# A major do Node é a mesma do .nvmrc na raiz (a CI usa o .nvmrc).

ARG NODE_VERSION=24

# ============================================================
# deps — todas as dependências (incl. devDeps e a CLI do Prisma)
# ============================================================
FROM node:${NODE_VERSION}-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ============================================================
# build — Prisma generate + Nest build
# ============================================================
FROM deps AS build

COPY . .
RUN npm run build          # "prisma generate && nest build"

# ============================================================
# migrate — imagem descartável de migração (e do seed inicial)
# Herda do build: CLI do Prisma, schema, migrations, client gerado e src/
# (prisma.config.ts e prisma/seed.ts importam src/config/database-url.ts).
#   docker compose run --rm migrate                          → migrate deploy
#   docker compose run --rm migrate npx ts-node prisma/seed.ts → seed
# ============================================================
FROM build AS migrate

USER node
CMD ["./node_modules/.bin/prisma", "migrate", "deploy"]

# ============================================================
# runtime — produção (apenas deps de produção)
# ============================================================
FROM node:${NODE_VERSION}-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Client gerado (Prisma 7 gera fora de node_modules) + build
COPY --from=build /app/generated ./generated
COPY --from=build /app/dist ./dist

USER node
EXPOSE 3000

# Node tem fetch nativo: dispensa curl/wget na imagem.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["node", "dist/src/main.js"]
