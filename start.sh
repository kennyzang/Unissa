#!/bin/bash
# ============================================================
# UNISSA Smart University Platform – Quick Start Script
# Usage: ./start.sh
# ============================================================

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

# Load environment variables
if [ -f "$ROOT/.env" ]; then
  export $(cat "$ROOT/.env" | grep -v '^#' | xargs)
fi

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  UNISSA Smart University Platform  –  POC v5.0       ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# Install deps if needed
if [ ! -d "$ROOT/node_modules" ]; then
  echo "📦 Installing dependencies..."
  cd "$ROOT" && yarn install
fi

# Run DB migration + seed if DB not exists
if [ ! -f "$BACKEND/prisma/dev.db" ]; then
  echo "🗄️  Initialising database..."
  cd "$BACKEND" && npx prisma migrate deploy --schema prisma/schema.prisma
  cd "$BACKEND" && npx tsx prisma/seed.ts
  cd "$ROOT"
fi

echo "🚀 Starting services..."
echo "   Backend  → http://localhost:4000"
echo "   Frontend → http://localhost:5173"
echo ""
echo "Demo Accounts (all passwords: Demo@2026)"
echo "  admin / noor / admissions / drsiti / drahmad / manager / hradmin / finance"
echo ""

# Free ports if already in use
lsof -ti:4000 -ti:5173 | xargs kill -9 2>/dev/null || true

# Start both services
cd "$ROOT" && yarn run dev
