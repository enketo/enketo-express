#!/usr/bin/env bash
cd /srv/enketo-express
python setup/docker/create_config.py
grunt
npm start