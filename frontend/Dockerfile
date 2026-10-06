# syntax=docker/dockerfile:1
# Target final: runtime (nginx sem root na porta 8080).
# A URL da API NÃO entra no build: o front chama "/api" relativo e o Traefik
# roteia por path. A mesma imagem funciona em qualquer domínio.

ARG NODE_VERSION=24

# ============================================================
# build — Vite + React + TypeScript
# ============================================================
FROM node:${NODE_VERSION}-alpine AS build

WORKDIR /app

# Login demo (opcional). VITE_* fica embutido no bundle PÚBLICO: use só uma
# conta sem privilégios. Vazio = botão de demo oculto.
ARG VITE_DEMO_ADMIN_EMAIL=""
ENV VITE_DEMO_ADMIN_EMAIL=$VITE_DEMO_ADMIN_EMAIL

ARG VITE_DEMO_ADMIN_PASSWORD=""
ENV VITE_DEMO_ADMIN_PASSWORD=$VITE_DEMO_ADMIN_PASSWORD

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build          # "tsc --noEmit && vite build"

# ============================================================
# runtime — estático (nginx sem root)
# ============================================================
FROM nginxinc/nginx-unprivileged:1.28-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
