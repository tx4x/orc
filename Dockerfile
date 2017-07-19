FROM debian:sid
LABEL maintainer "gordonh@member.fsf.org"
RUN apt-get update
RUN DEBIAN_FRONTEND=noninteractive apt-get -yq upgrade
RUN DEBIAN_FRONTEND=noninteractive apt-get -yq install wget apt-transport-https gnupg
RUN wget -qO - https://apt.z.cash/zcash.asc | apt-key add -
RUN wget -qO - https://deb.nodesource.com/setup_6.x | bash -
RUN echo "deb [arch=amd64] https://apt.z.cash/ jessie main" | tee /etc/apt/sources.list.d/zcash.list
RUN apt-get update; \
    DEBIAN_FRONTEND=noninteractive apt-get -yq install vim libssl-dev git python build-essential tor zcash nodejs
RUN zcash-fetch-params
RUN git clone https://github.com/orcproject/orc /root/orc; \
    cd /root/orc && npm install && npm link && cd
RUN mkdir /root/.zcash; \
    echo "rpcuser=orc" >> /root/.zcash/zcash.conf; \
    echo "rpcpassword=orc" >> /root/.zcash/zcash.conf; \
    echo "proxy=127.0.0.1:9050" >> /root/.zcash/zcash.conf; \
    echo "mainnet=1" >> /root/.zcash/zcash.conf; \
    echo "addnode=mainnet.z.cash" >> /root/.zcash/zcash.conf
RUN echo "#\!/bin/bash" >> /root/orc.sh; \
    echo "tor --runasdaemon 1" >> /root/orc.sh; \
    echo "zcashd -daemon" >> /root/orc.sh; \
    echo "orc" >> /root/orc.sh \
RUN chmod +x /root/orc.sh
RUN mkdir -p /root/.config/orc
VOLUME ["/root/.config/orc"]
EXPOSE 4443 4444 4445
CMD ["/root/orc.sh"]
ENTRYPOINT []
