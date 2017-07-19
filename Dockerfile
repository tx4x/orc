FROM debian:sid
LABEL maintainer "gordonh@member.fsf.org"
RUN apt-get update
RUN DEBIAN_FRONTEND=noninteractive apt-get -yq upgrade
RUN DEBIAN_FRONTEND=noninteractive apt-get -yq install wget apt-transport-https gnupg curl
RUN wget -qO - https://apt.z.cash/zcash.asc | apt-key add -
RUN echo "deb [arch=amd64] https://apt.z.cash/ jessie main" | tee /etc/apt/sources.list.d/zcash.list
RUN apt-get update; \
    DEBIAN_FRONTEND=noninteractive apt-get -yq install vim libssl-dev git python build-essential tor zcash
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
RUN zcash-fetch-params
RUN git clone https://github.com/orcproject/orc ~/orc; \
    cd ~/orc && npm install && npm link && cd
RUN mkdir ~/.zcash; \
    echo "rpcuser=orc" >> ~/.zcash/zcash.conf; \
    echo "rpcpassword=orc" >> ~/.zcash/zcash.conf; \
    echo "proxy=127.0.0.1:9050" >> ~/.zcash/zcash.conf; \
    echo "mainnet=1" >> ~/.zcash/zcash.conf; \
    echo "addnode=mainnet.z.cash" >> ~/.zcash/zcash.conf
RUN echo "#\!/bin/bash" >> ~/orc.sh; \
    echo "tor --runasdaemon 1" >> ~/orc.sh; \
    echo "zcashd -daemon" >> ~/orc.sh; \
    echo "orc" >> ~/orc.sh
RUN chmod +x ~/orc.sh
RUN mkdir -p ~/.config/orc
VOLUME ["/root/.config/orc"]
CMD ~/orc.sh
ENTRYPOINT []
