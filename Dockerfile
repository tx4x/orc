FROM debian:8
LABEL maintainer "gordonh@member.fsf.org"
RUN apt-get update
RUN DEBIAN_FRONTEND=noninteractive apt-get -yq upgrade
RUN DEBIAN_FRONTEND=noninteractive apt-get -yq install wget apt-transport-https gnupg curl
RUN echo "deb http://deb.torproject.org/torproject.org jessie main" >> /etc/apt/sources.list; \
    echo "deb-src http://deb.torproject.org/torproject.org jessie main" >> /etc/apt/sources.list
RUN gpg --keyserver keys.gnupg.net --recv A3C4F0F979CAA22CDBA8F512EE8CBC9E886DDD89; \
    gpg --export A3C4F0F979CAA22CDBA8F512EE8CBC9E886DDD89 | apt-key add -
RUN apt-get update; \
    DEBIAN_FRONTEND=noninteractive apt-get -yq install libssl-dev git python build-essential tor deb.torproject.org-keyring
RUN set -ex \
  && for key in \
    9554F04D7259F04124DE6B476D5A82AC7E37093B \
    94AE36675C464D64BAFA68DD7434390BDBE9B9C5 \
    FD3A5288F042B6850C66B31F09FE44734EB7990E \
    71DCFD284A79C3B38668286BC97EC7A07EDE3FC1 \
    DD8F2338BAE7501E3DD5AC78C273792F7D83545D \
    B9AE9905FFD7803F25714661B63B535A4C206CA9 \
    C4F0DFFF4E8C1A8236409D08E73BC641CC11F4C8 \
    56730D5401028683275BD23C23EFEFE93C4CFFFE \
  ; do \
    gpg --keyserver pgp.mit.edu --recv-keys "$key" || \
    gpg --keyserver keyserver.pgp.com --recv-keys "$key" || \
    gpg --keyserver ha.pool.sks-keyservers.net --recv-keys "$key" ; \
  done
ENV NPM_CONFIG_LOGLEVEL info
ENV NODE_VERSION 6.11.1
RUN curl -SLO "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-x64.tar.xz" \
  && curl -SLO --compressed "https://nodejs.org/dist/v$NODE_VERSION/SHASUMS256.txt.asc" \
  && gpg --batch --decrypt --output SHASUMS256.txt SHASUMS256.txt.asc \
  && grep " node-v$NODE_VERSION-linux-x64.tar.xz\$" SHASUMS256.txt | sha256sum -c - \
  && tar -xJf "node-v$NODE_VERSION-linux-x64.tar.xz" -C /usr/local --strip-components=1 \
  && rm "node-v$NODE_VERSION-linux-x64.tar.xz" SHASUMS256.txt.asc SHASUMS256.txt \
  && ln -s /usr/local/bin/node /usr/local/bin/nodejs
RUN git clone https://github.com/orcproject/orc /root/orc; \
    cd /root/orc && npm install --unsafe-perm
ENV orc_ControlHostname="0.0.0.0" orc_BridgeHostname="0.0.0.0" orc_DirectoryHostname="0.0.0.0"
VOLUME ["/root/.config/orc"]
EXPOSE 4443 4444 4445 4446 37017
ENTRYPOINT ["node", "/root/orc/bin/orc.js"]
CMD []
