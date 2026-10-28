#!/usr/bin/env bash

set -euo pipefail

echo "=============================================================================="
echo "            HOTEL & RESTAURANT LOCAL MASTER SERVER INITIALIZER               "
echo "=============================================================================="

export NODE_ENV="production"

npm run start:master
