#!/usr/bin/env bash

echo "=============================================================================="
echo "            HOTEL & RESTAURANT LOCAL MASTER SERVER INITIALIZER               "
echo "=============================================================================="
echo "[INFO] Starting Local Master Server bound to 0.0.0.0 (Port 3000)..."
echo "[INFO] All staff phones, reception PCs, and POS terminals on LAN Wi-Fi"
echo "       can connect using your Master PC Local IP address."
echo "=============================================================================="

# Detect local IP address on macOS / Linux
if command -v ip &> /dev/null; then
    LOCAL_IP=$(ip route get 1.1.1.1 2>/dev/null | grep -oP 'src \K\S+')
elif command -v ifconfig &> /dev/null; then
    LOCAL_IP=$(ifconfig | grep -E 'inet ' | grep -v '127.0.0.1' | awk '{print $2}' | head -n 1)
else
    LOCAL_IP="<YOUR_MASTER_PC_IP>"
fi

echo "[LAN NETWORK IP] http://${LOCAL_IP}:3000"
echo "=============================================================================="
echo "[LAUNCHING] Next.js Application in Local Network Master Mode..."
echo "=============================================================================="

export HOST=0.0.0.0
export PORT=3000
export NODE_ENV=production

if [ -f "pnpm-lock.yaml" ]; then
    pnpm start -H 0.0.0.0 -p 3000
else
    npm run start -- -H 0.0.0.0 -p 3000
fi
