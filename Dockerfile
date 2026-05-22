# syntax=docker/dockerfile:1

# ── Build stage — install all dependencies and bundle the React client ──────
FROM node:22-alpine AS build
WORKDIR /app

# Install dependencies first; this layer is cached unless the manifests change.
COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
RUN npm ci

# Copy the rest of the source and build the client into client/dist.
COPY . .
RUN npm run build

# ── Runtime stage — server + built client only ──────────────────────────────
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Production server dependencies only — no client/build tooling, no devDeps.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-workspaces && npm cache clean --force

COPY server ./server
COPY --from=build /app/client/dist ./client/dist

EXPOSE 8080

# Liveness probe against the public auth-config endpoint.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/api/auth/config').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
