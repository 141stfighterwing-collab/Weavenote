# Dockerfile for the migration helper service
# Builds a small Node-based image with optional docker client (for docker-socket mode).
# Two-mode runtime:
#  - DOCKER_SOCKET mode: container has access to host docker socket (/var/run/docker.sock) and can create a temporary MongoDB container for migration.
#  - NO_SOCKET mode: set MONGODB_URI to point to an external MongoDB and the helper will use that directly.

FROM node:18-alpine

# Install docker CLI so this container can control Docker via the host socket when mounted.
# Note: Installing docker CLI increases image size and surface area. Only include it when needed.
RUN apk add --no-cache bash curl docker-cli

# Create app directory
WORKDIR /usr/src/app

# Copy package.json first to install deps
COPY package.json ./
RUN npm ci --only=production

# Copy application files
COPY . .

# Create a non-root user for safer defaults
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /usr/src/app

USER appuser

EXPOSE 8080

# By default run the express UI. Use CMD args or env to change behavior.
CMD ["node","app.js"]
