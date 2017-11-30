#!/bin/sh

# start chutney tor simulation
/root/chutney/chutney start /root/chutney/networks/basic

# start some orc providers
node /root/orc/bin/orcd.js --datadir /root/orc-providers/1 --daemon
node /root/orc/bin/orcd.js --datadir /root/orc-providers/2 --daemon
node /root/orc/bin/orcd.js --datadir /root/orc-providers/3 --daemon

# start our main orc interface
node /root/orc/bin/ord.js 
