# syntax=docker/dockerfile:1.7
# Carevanta Patient app image (Next.js standalone server on port 3002).
#
# NEXT_PUBLIC_* values are baked into the browser code at build time, so they are build arguments:
#   docker build --build-arg NEXT_PUBLIC_API_URL=https://api.example.com -t carevanta-app .
# No secrets belong here: everything NEXT_PUBLIC_ is visible to every visitor.

# ── 1. Install dependencies (cached until package files change) ──
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci

# ── 2. Build the app with the public settings for this environment ──
FROM node:22-bookworm-slim AS build
WORKDIR /app
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_PORTAL_URL=""
ARG NEXT_PUBLIC_MAP_TILE_URL=""
ARG NEXT_PUBLIC_MAP_ATTRIBUTION=""
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL     NEXT_PUBLIC_PORTAL_URL=$NEXT_PUBLIC_PORTAL_URL     NEXT_PUBLIC_MAP_TILE_URL=$NEXT_PUBLIC_MAP_TILE_URL     NEXT_PUBLIC_MAP_ATTRIBUTION=$NEXT_PUBLIC_MAP_ATTRIBUTION     NEXT_TELEMETRY_DISABLED=1
RUN test -n "$NEXT_PUBLIC_API_URL" || (echo "Build argument NEXT_PUBLIC_API_URL is required" && exit 1)
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── 3. Runtime: only the standalone server, its static files and public assets; runs as a non-root user ──
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production     NEXT_TELEMETRY_DISABLED=1     PORT=3002     HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3   CMD node -e "fetch('http://127.0.0.1:3002/').then((r) => process.exit(r.status < 500 ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "server.js"]
