#!/bin/sh

# start shadow tor simulation
/root/.shadow/bin/shadow /root/shadow-tor/shadow.config.xml #> /dev/null 2>&1 &

# start some orc providers
# orcd_ShardStorageAllocation="1GB" node /root/orc/bin/orcd.js --datadir /root/orc-providers/1 --daemon
# orcd_NetworkBootstrapNodes="http://$(cat /root/orc-providers/1/node_hs/hidden_service/hostname)" orcd_ShardStorageAllocation="1GB" node /root/orc/bin/orcd.js --datadir /root/orc-providers/2 --daemon
# orcd_NetworkBootstrapNodes="http://$(cat /root/orc-providers/1/node_hs/hidden_service/hostname)" orcd_ShardStorageAllocation="1GB" node /root/orc/bin/orcd.js --datadir /root/orc-providers/3 --daemon


