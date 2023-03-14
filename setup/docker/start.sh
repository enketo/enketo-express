#!/bin/bash
set -e

source /etc/profile

cd ${ENKETO_SRC_DIR}/

# Create a config. file if necessary.
python setup/docker/create_config.py

# Run Enketo via PM2 Runtime (To support sigterm handling and
# logs are exposed e.g. via `docker logs enketoexpress_enketo_1`).
exec pm2-runtime app.js -n enketo
