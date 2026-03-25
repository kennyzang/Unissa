#!/bin/bash
# ============================================================
# UNISSA Smart University Platform – Quick Start Script
# Usage: ./start.sh
# ============================================================

set -e

export PNPM_HOME="$HOME/Library/pnpm"
export PATH="$PNPM_HOME:$PATH"

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  UNISSA Smart University Platform  –  POC v5.0       ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# Check pnpm
if ! command -v pnpm &> /dev/null; then
  echo "❌ pnpm not found. Install via: curl -fsSL https://get.pnpm.io/install.sh | sh -"
  exit 1
fi

# Install deps if needed
if [ ! -d "$ROOT/node_modules" ]; then
  echo "📦 Installing dependencies..."
  cd "$ROOT" && pnpm install
fi

# Run DB migration + seed if DB not exists
if [ ! -f "$BACKEND/dev.db" ]; then
  echo "🗄️  Initialising database..."
  cd "$BACKEND"
  pnpm exec prisma migrate deploy
  pnpm exec tsx prisma/seed.ts
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
cd "$ROOT" && pnpm run dev
