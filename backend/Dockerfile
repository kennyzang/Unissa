# ============================================================
# UNISSA Backend – Dockerfile
# Node.js 20 + Express + Prisma + SQLite
# ============================================================

# ---- Build stage ----
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build
RUN npx prisma generate

# ---- Runtime stage ----
FROM node:20-alpine
WORKDIR /app

# Create data directory for SQLite persistence
RUN mkdir -p /app/data

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma

COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 4000

ENTRYPOINT ["./docker-entrypoint.sh"]
