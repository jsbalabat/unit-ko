# syntax=docker/dockerfile:1

# Multi-stage build for @unitko/api (NestJS) within the pnpm + Turborepo monorepo.
# Build from the REPO ROOT so the whole workspace is in context:
#   docker build -f apps/api/Dockerfile -t unitko-api .

# ---- base: Node + pnpm (via corepack) ----
# Node 22+ is required at runtime: @supabase/supabase-js constructs a
# RealtimeClient on createClient(), which needs a native global WebSocket (added
# to Node in v22). Local dev runs Node 24, which masked this — Docker surfaced it.
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# ---- pruner: shrink the monorepo to @unitko/api and its workspace deps ----
# `turbo prune --docker` writes two trees so install and build cache separately:
#   out/json → only the package.json files + lockfile  (the dependency layer)
#   out/full → the pruned source                        (the build layer)
FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2.3.0 prune @unitko/api --docker

# ---- builder: install, then build ----
FROM base AS builder
# Dependency layer first — editing source won't invalidate the install cache.
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
# Then source, and build. Turbo builds @unitko/shared before @unitko/api (^build).
COPY --from=pruner /app/out/full/ .
# `turbo prune` doesn't carry root config files that packages extend; the shared
# and api tsconfigs both extend ../../tsconfig.base.json, so bring it in by hand.
COPY tsconfig.base.json ./tsconfig.base.json
RUN pnpm turbo build --filter=@unitko/api
# Strip devDependencies so the runtime image carries production deps only.
# (If this step ever misbehaves, removing it just yields a larger—but working—image.)
RUN pnpm prune --prod

# ---- runner: minimal runtime image ----
FROM base AS runner
ENV NODE_ENV=production
# Drop root; the official node image ships an unprivileged `node` user.
USER node
COPY --from=builder --chown=node:node /app .
# The API reads PORT from the environment (defaults to 3001).
EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
