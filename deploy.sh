#!/bin/sh
GENERATE_SOURCEMAP=false
SRC="public/*.*"
TARGET="/opt/enketo-express/public/ "

if [ -f $SRC ]; then
  rm -R /opt/enketo-express/public
  cp -R $SRC $TARGET
  sudo systemctl restart enketo
else
  echo "Dir not found: $SRC"
  exit 1
fi
