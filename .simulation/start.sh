#!/bin/sh

# start chutney tor simulation
/root/chutney/chutney start /root/chutney/networks/basic

# cleanup pid files
rm /root/.config/orcd/orcd.pid
rm /root/providers/1/orcd.pid
rm /root/providers/2/orcd.pid
rm /root/providers/3/orcd.pid

# start some orc providers
node /root/orc/bin/orcd.js --datadir /root/providers/1 --daemon 
node /root/orc/bin/orcd.js --datadir /root/providers/2 --daemon
node /root/orc/bin/orcd.js --datadir /root/providers/3 --daemon 

# start our main orc interface
orcd_BridgeAuthenticationEnabled=0 orcd_NetworkBootstrapNodes="http://l466qntstik7falkkzxttgrtlu4u7g6yaxmyvjs2qamlzymsdsiqxdqd.onion:80" node /root/orc/bin/orcd.js 
