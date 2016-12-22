#!/bin/bash
set -e

source /etc/profile

cd ${ENKETO_SRC_DIR}/

# Create a config. file if necessary.
python setup/docker/create_config.py

# Build.
grunt
# FIXME: Now that the client config. has been built, build again as a workaround to a `grunt` task sequencing issue.
grunt
