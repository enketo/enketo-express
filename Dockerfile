FROM node:16

ENV ENKETO_SRC_DIR=/srv/src/enketo_express
WORKDIR ${ENKETO_SRC_DIR}

RUN npm install -g pm2@$(npm info pm2 version)

COPY . ${ENKETO_SRC_DIR}

RUN npm install -g npm@^6 && npm clean-install && npx grunt && npm prune --production

# Persist the `secrets` directory so the encryption key remains consistent.
RUN mkdir -p ${ENKETO_SRC_DIR}/setup/docker/secrets
VOLUME ${ENKETO_SRC_DIR}/setup/docker/secrets

EXPOSE 8005

CMD ${ENKETO_SRC_DIR}/setup/docker/start.sh
