#!/usr/bin/env bash

apt-get update

# install redis
add-apt-repository -y ppa:rwky/redis
apt-get update
apt-get install -y redis-server

# install XML prerequisites for node_xslt
apt-get install -y libxml2-dev libxslt1-dev

# install development tools, node, grunt #, ruby, sass gem
apt-get install -y python-software-properties python g++ make
add-apt-repository ppa:chris-lea/node.js
apt-get update
apt-get install -y nodejs
npm install -g grunt-cli nodemon mocha
cd /vagrant
# remove node_modules if exists because npm builds can be system-specific
if [ -d "/vagrant/node_modules" ]; then
	rm -R /vagrant/node_modules
fi
npm install 

# build js and css
grunt
