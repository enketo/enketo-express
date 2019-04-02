#!/bin/bash
set -e

source /etc/profile

cd ${ENKETO_SRC_DIR}/

# Create a config. file if necessary.
python setup/docker/create_config.py

CHECKSUM_DIR_PATH="${ENKETO_SRC_DIR}/checksum"

CONFIG_FILE="config.json"
CONFIG_FILE_PATH="${ENKETO_SRC_DIR}/config/${CONFIG_FILE}"
SHA1SUM_CONFIG_FILE_PATH="${CHECKSUM_DIR_PATH}/${CONFIG_FILE}.sha1"

LAST_BUILD_COMMIT_FILE="last_build_commit.txt"
LAST_BUILD_COMMIT_FILE_PATH="${CHECKSUM_DIR_PATH}/${LAST_BUILD_COMMIT_FILE}"

# Compare config version
set +e  # Do not exit on `sha1sum` or `cat` error
sha1sum -c "${SHA1SUM_CONFIG_FILE_PATH}"
RUN_GRUNT=$([[ $? -eq 0 ]] && echo 0 || echo 1)

# Compare commit version
CURRENT_COMMIT=$(git rev-parse HEAD) # Get current commit
LAST_BUILD_COMMIT=$(cat ${LAST_BUILD_COMMIT_FILE_PATH})
RUN_GRUNT=$([[ "$RUN_GRUNT" == 0 && "$CURRENT_COMMIT" == "$LAST_BUILD_COMMIT" ]] && echo 0 || echo 1)

set -e  # Restore exit mode

if [ "$RUN_GRUNT" == 1 ]; then
    # Build.
    grunt
    echo "Saving current commit..."
    echo $CURRENT_COMMIT > ${LAST_BUILD_COMMIT_FILE_PATH}
    echo "Saving config hash..."
    sha1sum ${CONFIG_FILE_PATH} > "${SHA1SUM_CONFIG_FILE_PATH}"
fi
