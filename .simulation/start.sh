#!/bin/sh

echo "starting chutney tor sandbox nodes"
/root/chutney/chutney start /root/chutney/networks/hs-v3-intro

echo "starting orc provider 1 (seed) as daemon..."
node /root/orc/bin/orcd.js --datadir /root/providers/1 --daemon 
echo "done."

echo "waiting 30 seconds for hs descriptors to be ready..."
sleep 30
echo "starting orc provider 2 as daemon"
node /root/orc/bin/orcd.js --datadir /root/providers/2 --daemon

echo "starting orc provider 3 as daemon"
node /root/orc/bin/orcd.js --datadir /root/providers/3 --daemon 

echo "waiting 1 minute for hs descriptors to be ready..."
sleep 60
echo "starting orc node, exposing bridge at port 9089"
orcd_BridgeAuthenticationEnabled=0 orcd_NetworkBootstrapNodes="http://l466qntstik7falkkzxttgrtlu4u7g6yaxmyvjs2qamlzymsdsiqxdqd.onion:80" node /root/orc/bin/orcd.js 
