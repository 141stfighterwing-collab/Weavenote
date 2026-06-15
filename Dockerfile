# ── WSH Dockerfile v4.4.9 ────────────────────────────────────────
# Multi-stage build with progress output. Update with: ./update.sh
#
# Stage 1 (deps):   npm install (cached unless package.json changes)
# Stage 2 (build):  prisma generate → next build → standalone output
# Stage 3 (runner): Lean production image with standalone server
#
# v4.4.9 FIX: Removed | tail pipes that hid npm install errors.
# The pipe caused npm install failures to be silently swallowed
# (tail's exit code 0 replaced npm's non-zero exit code).
# Root cause: react-devtools-inline@4.4.1 was yanked from npm,
# making npm install fail with no visible error message.

FROM node:20-alpine AS deps

ARG BUILD_VERSION=4.4.9

# System deps for building
RUN echo "[1/6] Installing system dependencies..." && \
    apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copy package files first for layer caching
COPY package.json package-lock.json* ./

# Install ALL dependencies (production + dev needed for build)
# IMPORTANT: Do NOT pipe npm output to tail — that hides errors!
# If npm install fails, the build MUST stop here.
RUN echo "[2/6] Installing npm packages..." && \
    npm install 2>&1 && \
    echo "[2/6] ✓ npm install complete ($(ls node_modules | wc -l) packages)"

# ── Stage 2: Build ─────────────────────────────────────────────
FROM deps AS builder

# System deps for build
RUN echo "[3/6] Installing build tools..." && \
    apk add --no-cache openssl

WORKDIR /app

# Copy source code
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# Generate Prisma client (self-healing: installs prisma if missing from stale cache)
# Uses ./node_modules/.bin/prisma (standard npm bin path) instead of npx
# to prevent downloading Prisma v7.x from npm. Falls back to npm install
# if the binary is missing (can happen with stale Docker layer cache).
RUN echo "[4/6] Generating Prisma client..." && \
    if [ ! -x ./node_modules/.bin/prisma ]; then \
      echo "  [prisma] CLI missing from cache, installing prisma@^6..." && \
      npm install prisma@^6 --no-audit --no-fund; \
    fi && \
    ./node_modules/.bin/prisma generate 2>&1 && \
    echo "[4/6] ✓ Prisma client generated"

# Build Next.js (standalone output)
RUN echo "[5/6] Building Next.js application..." && \
    npm run build 2>&1 && \
    echo "[5/6] ✓ Next.js build complete"

# ── Stage 3: Production Runner ─────────────────────────────────
FROM node:20-alpine AS runner

ARG BUILD_VERSION=4.4.9
ENV BUILD_VERSION=${BUILD_VERSION}

RUN echo "[6/6] Creating production image (v${BUILD_VERSION})..." && \
    apk add --no-cache openssl wget bind-tools su-exec

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user (app runs as this user via su-exec in entrypoint)
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Install production deps (includes prisma + ALL transitive deps).
# IMPORTANT: Do NOT pipe npm output to tail — that hides errors!
# If npm install fails, the build MUST stop here.
COPY --from=deps --chown=nextjs:nodejs /app/package.json /app/package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund && \
    chown -R nextjs:nodejs node_modules && \
    echo "[prisma] ✓ Production deps + Prisma CLI + all transitive deps installed"

# Copy Prisma schema
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Regenerate Prisma client into production node_modules (ensures .prisma/client
# matches the schema version, not a stale copy from the build stage)
RUN if [ ! -x ./node_modules/.bin/prisma ]; then \
      echo "  [prisma] CLI missing, installing prisma@^6..." && \
      npm install prisma@^6 --no-audit --no-fund; \
    fi && \
    ./node_modules/.bin/prisma generate && \
    chown -R nextjs:nodejs node_modules/.prisma && \
    echo "[prisma] ✓ Client regenerated for production"

# Copy standalone Next.js output (must come AFTER npm install so the
# standalone server can find @prisma/client in node_modules)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy entrypoint (LF line endings enforced)
COPY --from=builder --chown=nextjs:nodejs /app/docker-entrypoint.sh ./docker-entrypoint.sh
RUN sed -i 's/\r$//' /app/docker-entrypoint.sh && chmod +x /app/docker-entrypoint.sh

# Copy public assets
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Create runtime directories (ownership fixed at runtime by entrypoint)
RUN mkdir -p /app/tmp/env /app/tmp /app/db /app/upload && chown -R nextjs:nodejs /app/tmp /app/db /app/upload

# Build version stamp
RUN echo "BUILD_VERSION=${BUILD_VERSION}" > /app/.build-version && \
    echo "✓ Production image ready (v${BUILD_VERSION})"

# NOTE: Container starts as root so the entrypoint can fix Docker volume
# permissions (volumes are created with root:root ownership by default).
# The entrypoint chowns volumes and then drops to 'nextjs' via su-exec.
# Do NOT set USER nextjs here — it must remain root for the entrypoint.
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["sh", "/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
