# syntax=docker/dockerfile:1.7
# ─── Stage 1: prune ───
# Turbo prune crea un sub-monorepo con solo las deps que necesita @carnia/api
FROM node:24-alpine AS pruner
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm dlx turbo@2.11.5 prune @carnia/api --docker

# ─── Stage 2: install + build ───
FROM node:24-alpine AS builder
WORKDIR /app
ENV CI=true
RUN apk add --no-cache openssl libc6-compat python3 make g++
RUN corepack enable

# pnpm install solo con package.json + lockfile (cacheable). Sin scripts: el
# postinstall de @carnia/db necesita el esquema, que aún no está copiado.
COPY --from=pruner /app/out/json/ ./
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml
RUN pnpm install --frozen-lockfile --ignore-scripts

# Source completo del subset
COPY --from=pruner /app/out/full/ ./

# Build en orden: contracts → db (genera el cliente de Prisma y lo compila a dist) → api
RUN pnpm --filter @carnia/contracts build && \
    pnpm --filter @carnia/db build && \
    pnpm --filter @carnia/api build

# Re-install solo prod deps (descarta devDeps del builder). El cliente de Prisma ya
# está compilado en packages/db/dist; el CLI queda para `migrate deploy`.
RUN pnpm install --frozen-lockfile --prod --ignore-scripts --force

# ─── Stage 3: runner ───
FROM node:24-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl libc6-compat tini && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 carnia

ENV NODE_ENV=production
ENV API_PORT=3001

# Copia solo lo estrictamente necesario en runtime
COPY --from=builder --chown=carnia:nodejs /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder --chown=carnia:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=carnia:nodejs /app/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=builder --chown=carnia:nodejs /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=builder --chown=carnia:nodejs /app/packages/contracts/node_modules ./packages/contracts/node_modules
COPY --from=builder --chown=carnia:nodejs /app/packages/db/package.json ./packages/db/package.json
COPY --from=builder --chown=carnia:nodejs /app/packages/db/dist ./packages/db/dist
COPY --from=builder --chown=carnia:nodejs /app/packages/db/prisma ./packages/db/prisma
COPY --from=builder --chown=carnia:nodejs /app/packages/db/prisma.config.ts ./packages/db/prisma.config.ts
COPY --from=builder --chown=carnia:nodejs /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=builder --chown=carnia:nodejs /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder --chown=carnia:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=carnia:nodejs /app/apps/api/node_modules ./apps/api/node_modules

USER carnia
EXPOSE 3001

# tini reapea zombies y propaga SIGTERM correctamente
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/api/dist/main.js"]
