#!/usr/bin/env bash

set -euo pipefail

echo "=============================================================================="
echo "            HOTEL & RESTAURANT LOCAL MASTER SERVER INITIALIZER               "
echo "=============================================================================="

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-3000}"

echo "[INFO] Starting Local Master Server on host ${HOST} (Port ${PORT})..."
echo "=============================================================================="

# Detect local IP address on macOS / Linux
LOCAL_IP="127.0.0.1"
if command -v ip &> /dev/null; then
    LOCAL_IP="$(ip route get 1.1.1.1 2>/dev/null | grep -oP 'src \K\S+' || echo "127.0.0.1")"
elif command -v ifconfig &> /dev/null; then
    LOCAL_IP="$(ifconfig | grep -E 'inet ' | grep -v '127.0.0.1' | awk '{print $2}' | head -n 1 || echo "127.0.0.1")"
fi

echo "[LAN NETWORK IP] http://${LOCAL_IP}:${PORT}"
echo "=============================================================================="
echo "[LAUNCHING] Next.js Application in Local Master Mode..."
echo "=============================================================================="

export NODE_ENV="production"

if [ -f "pnpm-lock.yaml" ]; then
    exec pnpm start -H "$HOST" -p "$PORT"
else
    exec npm run start -- -H "$HOST" -p "$PORT"
fi
