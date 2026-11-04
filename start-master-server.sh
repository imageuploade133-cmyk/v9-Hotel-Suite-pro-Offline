#!/usr/bin/env bash

set -euo pipefail

echo "=============================================================================="
echo "            HOTEL AND RESTAURANT LOCAL MASTER SERVER INITIALIZER               "
echo "=============================================================================="

export NODE_ENV="production"
export NEXT_IGNORE_INCORRECT_NODE_VERSION=1

npm run start:master
