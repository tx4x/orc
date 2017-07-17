Farming is the most important part of of the ORC network. More farmers means 
stronger security, more anonymity, higher resilience to data loss, and more 
space for storing objects. Farmers "rent" out their space hard drive space in 
exchange for Zcash.

It's easy to configure ORC for farming. Check out the {@tutorial config} for 
an overview of all configuration properties - this guide only covers what is 
needed for farming. This guide also assumes you have properly installed ORC via 
the provided Docker image or have completed the {@tutorial install} guide.

### Allocate Storage Capacity

Set the base directory (parent) for where the contracts.db folder will be 
placed. The contracts.db holds storage contracts between you and other nodes.

```
ContractStorageBaseDir = /home/bookchin/.config/orc
```

Set the base directory (parent) for where the shards folder will be placed. The 
shards stores other nodes data shards, so be sure you set this to where you 
intend to store farmed shards.

```
ShardStorageBaseDir = /home/bookchin/.config/orc
```

Define the maximum size you wish to allocate for farming shards. This can be 
increased later, but decreasing it will not delete existing data.

```
ShardStorageMaxAllocation = 0GB
```

Enables renter nodes to directly claim storage capacity based on any capacity 
announcements you have made. If you are farming, set this value once for every 
trusted renter public extended key from which you will accept claims or once 
with a value of *. 

```
AllowDirectStorageClaims[] = *
```

### Connect Zcash Wallet

Complete information about how orc should connect to the Zcash RPC server. 
Orc needs this to generate addresses for farmers, send payments from renters, 
check balances, etc.

```
WalletHostname = localhost
WalletPort = 8232
WalletUser = orc
WalletPassword = orc
WalletShieldedTransactions = 0
```

### Enable Farming Profile

Pre-scripted profiles to enable after bootstrapping.Farmer profiles publish 
capacity announcements and listen for contracts to store data. 

```
ProfilesEnabled[] = farmer
```

### Fine Tune Farmer Behavior

Topic codes to use when operating under the farmer profile for subscibing to
contract publications and announcing capacity. See the protocol specification 
for more details. It is mostly reccommended to leave these at their default 
values.

```
FarmerAdvertiseTopics[] = 01020202
FarmerAdvertiseTopics[] = 02020202
FarmerAdvertiseTopics[] = 03020202
```

How often a farmer profile should scan contract database to reap expired 
shards it is storing.

```
FarmerShardReaperInterval = 24HR
```

How often a farmer profile should publish a capacity announcement to it's
neighboring nodes.

```
FarmerAnnounceInterval = 15M
```
