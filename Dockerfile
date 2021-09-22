FROM node:12

ENV ENKETO_SRC_DIR=/srv/src/enketo_express
WORKDIR ${ENKETO_SRC_DIR}

# TODO: version pinning
RUN npm install -g grunt-cli pm2

COPY . ${ENKETO_SRC_DIR}

RUN npm install
RUN grunt

# Persist the `secrets` directory so the encryption key remains consistent.
RUN mkdir -p ${ENKETO_SRC_DIR}/setup/docker/secrets
VOLUME ${ENKETO_SRC_DIR}/setup/docker/secrets

EXPOSE 8005

CMD ["/bin/bash", "-c", "${ENKETO_SRC_DIR}/setup/docker/start.sh"]
