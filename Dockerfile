FROM node:14

ENV ENKETO_SRC_DIR=/srv/src/enketo_express
WORKDIR ${ENKETO_SRC_DIR}

RUN npm install -g pm2@$(npm info pm2 version)

COPY . ${ENKETO_SRC_DIR}

RUN npm clean-install && npx grunt && npm prune --production

# Persist the `secrets` directory so the encryption key remains consistent.
RUN mkdir -p ${ENKETO_SRC_DIR}/setup/docker/secrets
VOLUME ${ENKETO_SRC_DIR}/setup/docker/secrets

EXPOSE 8005

# Override the base image's ENTRYPOINT instead of passing arguments to it using
# CMD, and use the "exec form" to avoid spawning an intermediary shell.
# NB: Docker will not expand environment variables like ENKETO_SRC_DIR within
# the ENTRYPOINT instruction; see
# https://docs.docker.com/engine/reference/builder/#environment-replacement
ENTRYPOINT ["/srv/src/enketo_express/setup/docker/start.sh"]
