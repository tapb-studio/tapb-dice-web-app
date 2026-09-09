# syntax=docker/dockerfile:1

# -----------------------------------------------------------------------------
# Stage 1: Install dependencies
# -----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS deps
WORKDIR /app

# Install build dependencies for native C++ addons (better-sqlite3)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

# -----------------------------------------------------------------------------
# Stage 2: Build the Next.js application
# -----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# Remove development dependencies to keep final image slim
RUN npm prune --omit=dev

# -----------------------------------------------------------------------------
# Stage 3: Production runner
# -----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/app/database/app.db
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root system user for security
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 -g nodejs nextjs

# Create persistent database folder with non-root ownership
RUN mkdir -p /app/database && \
    chown -R nextjs:nodejs /app/database

# Copy static assets and built artifacts with nextjs ownership
COPY --chown=nextjs:nodejs --from=builder /app/public ./public
COPY --chown=nextjs:nodejs --from=builder /app/.next ./.next
COPY --chown=nextjs:nodejs --from=builder /app/node_modules ./node_modules
COPY --chown=nextjs:nodejs --from=builder /app/package.json ./package.json
COPY --chown=nextjs:nodejs --from=builder /app/server.js ./server.js
COPY --chown=nextjs:nodejs --from=builder /app/next.config.mjs ./next.config.mjs
COPY --chown=nextjs:nodejs --from=builder /app/lib ./lib

USER nextjs

EXPOSE 3000

# Mount persistent volume for SQLite database storage
VOLUME ["/app/database"]

CMD ["node", "server.js"]
