# ============================================================
# UNISSA Frontend – Dockerfile (multi-stage build)
# Vite + React → static files
# ============================================================

FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

# Output: /app/dist  (consumed by nginx/Dockerfile)
