# =============================================================================
# Weavenote Frontend - Multi-stage Production Dockerfile
# =============================================================================

# Stage 1: Build Environment
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Build arguments for environment variables
ARG VITE_API_URL
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_FIREBASE_MEASUREMENT_ID
ARG GEMINI_API_KEY
ARG API_KEY
ARG ADMIN_SETUP_PASS

# Set environment variables for build
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY
ENV VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN
ENV VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID
ENV VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET
ENV VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID
ENV VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID
ENV VITE_FIREBASE_MEASUREMENT_ID=$VITE_FIREBASE_MEASUREMENT_ID
ENV GEMINI_API_KEY=$GEMINI_API_KEY
ENV API_KEY=$API_KEY
ENV ADMIN_SETUP_PASS=$ADMIN_SETUP_PASS

# Build the application
RUN npm run build

# Stage 2: Production Environment
FROM nginx:alpine AS production

# Install curl for health checks
RUN apk add --no-cache curl

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Create directory for environment injection script
RUN mkdir -p /docker-entrypoint.d

# Create environment injection script (inline to ensure LF line endings)
RUN echo '#!/bin/sh' > /docker-entrypoint.d/40-inject-env.sh && \
    echo 'cat > /usr/share/nginx/html/runtime-config.js << EOF' >> /docker-entrypoint.d/40-inject-env.sh && \
    echo 'window.__RUNTIME_CONFIG__ = {' >> /docker-entrypoint.d/40-inject-env.sh && \
    echo '  apiUrl: "${VITE_API_URL:-/api}",' >> /docker-entrypoint.d/40-inject-env.sh && \
    echo '  geminiApiKey: "${GEMINI_API_KEY:-}",' >> /docker-entrypoint.d/40-inject-env.sh && \
    echo '  firebase: {' >> /docker-entrypoint.d/40-inject-env.sh && \
    echo '    apiKey: "${VITE_FIREBASE_API_KEY:-}",' >> /docker-entrypoint.d/40-inject-env.sh && \
    echo '    authDomain: "${VITE_FIREBASE_AUTH_DOMAIN:-}",' >> /docker-entrypoint.d/40-inject-env.sh && \
    echo '    projectId: "${VITE_FIREBASE_PROJECT_ID:-}",' >> /docker-entrypoint.d/40-inject-env.sh && \
    echo '    storageBucket: "${VITE_FIREBASE_STORAGE_BUCKET:-}",' >> /docker-entrypoint.d/40-inject-env.sh && \
    echo '    messagingSenderId: "${VITE_FIREBASE_MESSAGING_SENDER_ID:-}",' >> /docker-entrypoint.d/40-inject-env.sh && \
    echo '    appId: "${VITE_FIREBASE_APP_ID:-}",' >> /docker-entrypoint.d/40-inject-env.sh && \
    echo '    measurementId: "${VITE_FIREBASE_MEASUREMENT_ID:-}"' >> /docker-entrypoint.d/40-inject-env.sh && \
    echo '  }' >> /docker-entrypoint.d/40-inject-env.sh && \
    echo '};' >> /docker-entrypoint.d/40-inject-env.sh && \
    echo 'EOF' >> /docker-entrypoint.d/40-inject-env.sh && \
    echo 'echo "Runtime configuration injected"' >> /docker-entrypoint.d/40-inject-env.sh && \
    chmod +x /docker-entrypoint.d/40-inject-env.sh

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
