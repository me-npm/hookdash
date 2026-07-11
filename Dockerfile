FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build server
RUN npm run build:server

# Build dashboard
WORKDIR /app/dashboard
COPY dashboard/package*.json ./
RUN npm ci
COPY dashboard/ .
RUN npm run build

# ─── Production image ───────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dashboard/dist ./dashboard/dist

# Default config location
VOLUME ["/app/data"]
ENV HOOKDASH_DB_PATH=/app/data/hookdash.db

EXPOSE 9090

CMD ["node", "dist/index.js", "start", "--db", "/app/data/hookdash.db"]
