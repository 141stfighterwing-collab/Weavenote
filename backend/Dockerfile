# =============================================================================
# Weavenote Backend API - Production Dockerfile
# =============================================================================

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++ openssl

# Copy package files
COPY package.json package-lock.json* ./

# Install ALL dependencies (including devDependencies for prisma CLI)
RUN npm ci --legacy-peer-deps

# Copy Prisma schema
COPY prisma ./prisma/

# Generate Prisma Client using locally installed prisma (version 5.x)
RUN ./node_modules/.bin/prisma generate

# Copy source code
COPY . .

# Build TypeScript (if needed)
# RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache curl openssl

# Create non-root user
RUN addgroup -g 1001 -S weavenote && \
    adduser -S -D -H -u 1001 -h /app -s /sbin/nologin -G weavenote -g weavenote weavenote

# Copy package files
COPY package.json package-lock.json* ./

# Install ALL dependencies first (needed for prisma generate)
RUN npm ci --legacy-peer-deps

# Copy Prisma files
COPY prisma ./prisma/

# Generate Prisma client using locally installed prisma (version 5.x)
RUN ./node_modules/.bin/prisma generate

# Now remove devDependencies to keep image small
RUN npm prune --production && \
    npm cache clean --force

# Copy source code
COPY src ./src

# Set ownership
RUN chown -R weavenote:weavenote /app

# Switch to non-root user
USER weavenote

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3001/api/health || exit 1

# Start the application
CMD ["node", "src/index.js"]
