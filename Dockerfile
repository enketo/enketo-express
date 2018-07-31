FROM phusion/baseimage:latest

ENV ENKETO_SRC_DIR=/srv/src/enketo_express

################
# apt installs #
################

# Add NodeJS 8 repository
ADD https://deb.nodesource.com/gpgkey/nodesource.gpg.key /tmp/
RUN echo 'deb https://deb.nodesource.com/node_8.x xenial main' > /etc/apt/sources.list.d/nodesource.list && \
    apt-key add /tmp/nodesource.gpg.key

COPY ./setup/docker/apt_requirements.txt ${ENKETO_SRC_DIR}/setup/docker/
WORKDIR ${ENKETO_SRC_DIR}/
RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y nodejs $(cat setup/docker/apt_requirements.txt) && \
    apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Non-interactive equivalent of `dpkg-reconfigure -plow unattended-upgrades` (see https://blog.sleeplessbeastie.eu/2015/01/02/how-to-perform-unattended-upgrades/).
RUN cp /usr/share/unattended-upgrades/20auto-upgrades /etc/apt/apt.conf.d/20auto-upgrades

###############################
# Enketo Express Installation #
###############################

RUN npm install -g grunt-cli pm2
COPY ./package.json ${ENKETO_SRC_DIR}/
RUN npm install --production

COPY . ${ENKETO_SRC_DIR}
ENV PATH $PATH:${KPI_SRC_DIR}/node_modules/.bin

# Persist the `secrets` directory so the encryption key remains consistent.
RUN mkdir -p ${ENKETO_SRC_DIR}/setup/docker/secrets
VOLUME ${ENKETO_SRC_DIR}/setup/docker/secrets

# Prepare for execution.
RUN ln -s "${ENKETO_SRC_DIR}/setup/docker/01_setup_enketo.bash" /etc/my_init.d/ && \
    mkdir -p /etc/service/enketo_express && \
    ln -s "${ENKETO_SRC_DIR}/setup/docker/run_enketo.bash" /etc/service/enketo_express/run


EXPOSE 8005
