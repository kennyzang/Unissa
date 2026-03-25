#!/bin/sh
set -e

echo "==> Running Prisma migrations..."
npx prisma migrate deploy

echo "==> Starting UNISSA backend on port 4000..."
exec node dist/index.js
