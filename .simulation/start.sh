#!/bin/sh

# start shadow tor simulation
/root/.shadow/bin/shadow /root/shadow-tor/shadow.config.xml #> /dev/null 2>&1 &

# start some orc providers
#node /root/orc/bin/orcd.js --datadir /root/orc-providers/1 --daemon
#node /root/orc/bin/orcd.js --datadir /root/orc-providers/2 --daemon
#node /root/orc/bin/orcd.js --datadir /root/orc-providers/3 --daemon

# start our main orc interface
#node /root/orc/bin/ord.js 
