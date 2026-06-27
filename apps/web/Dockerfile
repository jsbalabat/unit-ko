# syntax=docker/dockerfile:1

# Multi-stage build for @unitko/web (Next.js 16) within the pnpm + Turborepo
# monorepo. Build from the REPO ROOT:
#   docker build -f apps/web/Dockerfile -t unitko-web .
#
# IMPORTANT: NEXT_PUBLIC_* values are inlined into the client bundle at BUILD
# time, so they are passed as --build-arg (not runtime env). The image is thus
# tied to the URLs it was built with — rebuild to point at a different backend.

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# ---- pruner: shrink the monorepo to @unitko/web + its workspace deps ----
FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2.3.0 prune @unitko/web --docker

# ---- builder: install, then build the standalone server ----
FROM base AS builder
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
# Root config the package tsconfigs extend (turbo prune doesn't carry it).
COPY tsconfig.base.json ./tsconfig.base.json

# NEXT_PUBLIC_* must be present BEFORE `next build` to be baked into the bundle.
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ARG NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

# Turbo builds @unitko/shared before @unitko/web (^build).
RUN pnpm turbo build --filter=@unitko/web

# ---- runner: the Next standalone server only ----
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
# Bind to all interfaces so the container is reachable from the host.
ENV HOSTNAME=0.0.0.0
USER node
# Standalone output is monorepo-rooted: it carries apps/web/server.js + the
# traced node_modules. Static assets and public/ live outside it — copy them in.
COPY --from=builder --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=node:node /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
