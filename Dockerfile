FROM ubuntu:trusty

EXPOSE 8005
CMD ["bash", "/srv/enketo-express/setup/docker/entrypoint.bash"]

################
# apt installs #
################

WORKDIR /srv
RUN apt-get update && \
    apt-get upgrade -y
RUN apt-get install -y curl && \
    curl -sL https://deb.nodesource.com/setup_4.x | bash -
COPY ./setup/docker/apt_packages.txt /srv/
RUN apt-get install -y $(cat apt_packages.txt)
# Non-interactive equivalent of `dpkg-reconfigure -plow unattended-upgrades` (see https://blog.sleeplessbeastie.eu/2015/01/02/how-to-perform-unattended-upgrades/).
RUN cp /usr/share/unattended-upgrades/20auto-upgrades /etc/apt/apt.conf.d/20auto-upgrades


###############################
# Enketo Express Installation #
###############################

RUN npm install -g grunt-cli pm2
# Checks out a fresh copy of the repo.
RUN git clone https://github.com/enketo/enketo-express.git
WORKDIR /srv/enketo-express
RUN npm cache clean &&\
    npm install

# Persist the `secrets` directory so the encryption key remains consistent.
RUN mkdir -p /srv/enketo-express/setup/docker/secrets
VOLUME /srv/enketo-express/setup/docker/secrets

