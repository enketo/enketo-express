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

RUN_GRUNT=0
# Compare config version
sha1sum -c "${SHA1SUM_CONFIG_FILE_PATH}" || RUN_GRUNT=1

# Compare commit version
CURRENT_COMMIT=$(git rev-parse HEAD) # Get current commit
LAST_BUILD_COMMIT=$(cat ${LAST_BUILD_COMMIT_FILE_PATH} || echo "-")
RUN_GRUNT=$([[ "$RUN_GRUNT" == 0 && "$CURRENT_COMMIT" == "$LAST_BUILD_COMMIT" ]] && echo 0 || echo 1)

# Ensure build files exist.
# Can't test only on the parent folder because it's created by docker
NOT_EMPTY_JS_PATH="public/js/build/.not-empty"
NOT_EMPTY_CSS_PATH="public/css/.not-empty"
NOT_EMPTY_LOCALES_PATH="locales/build/.not-empty"

RUN_GRUNT=$([[
    "$RUN_GRUNT" == 0 &&
    -f "$NOT_EMPTY_JS_PATH" &&
    -f "$NOT_EMPTY_CSS_PATH" &&
    -f "$NOT_EMPTY_LOCALES_PATH"
]] && echo 0 || echo 1)

if [ "$RUN_GRUNT" == 1 ]; then
    # Build.
    echo "Grunt needs to be run!"
    grunt
    echo "Saving current commit..."
    echo $CURRENT_COMMIT > ${LAST_BUILD_COMMIT_FILE_PATH}
    echo "Saving config hash..."
    sha1sum ${CONFIG_FILE_PATH} > "${SHA1SUM_CONFIG_FILE_PATH}"
    echo "Creating .not-empty files"
    touch $NOT_EMPTY_JS_PATH
    touch $NOT_EMPTY_CSS_PATH
    touch $NOT_EMPTY_LOCALES_PATH
fi
