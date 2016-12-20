#!/bin/bash
set -e

source /etc/profile

cd ${ENKETO_SRC_DIR}/

# Run Enketo via PM2 (without daemonizing, so logs are exposed
#   e.g. via `docker logs enketoexpress_enketo_1`).
exec pm2 start --no-daemon app.js -n enketo
