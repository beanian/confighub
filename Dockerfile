# Build stage - only builds the UI
FROM mcr.microsoft.com/devcontainers/javascript-node:20 AS builder

USER root
WORKDIR /build

# Copy only UI package files
COPY packages/ui/package*.json ./packages/ui/

# Install UI dependencies
WORKDIR /build/packages/ui
RUN npm install

# Copy UI source and config
COPY packages/ui/src ./src
COPY packages/ui/index.html ./
COPY packages/ui/vite.config.ts ./
COPY packages/ui/tsconfig.json ./
COPY packages/ui/tsconfig.node.json ./
COPY packages/ui/tailwind.config.js ./
COPY packages/ui/postcss.config.js ./

# Build UI
RUN npm run build

# Production stage
FROM mcr.microsoft.com/devcontainers/javascript-node:20

USER root

RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy API package files and install deps
COPY packages/api/package*.json ./
RUN npm install

# Copy API source
COPY packages/api/src ./src

# Copy built UI from builder
COPY --from=builder /build/packages/ui/dist ./public

# Copy startup script
COPY docker-start.sh ./docker-start.sh
RUN chmod +x ./docker-start.sh

# Create data directory
RUN mkdir -p /data/config-repo

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/data/confighub.db
ENV CONFIG_REPO_PATH=/data/config-repo
ENV JWT_SECRET=demo-secret-change-in-production

EXPOSE 3000

CMD ["./docker-start.sh"]
