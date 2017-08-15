Farming is the most important part of of the ORC network. More farmers means 
stronger security, more anonymity, higher resilience to data loss, and more 
space for storing objects. Farmers "rent" out their space hard drive space in 
exchange for Zcash.

It's easy to configure ORC for farming. Check out the {@tutorial config} for 
an overview of all configuration properties - this guide only covers what is 
needed for farming. This guide also assumes you have properly installed ORC via 
the provided Docker image or have completed the {@tutorial install} guide.

### Allocate Storage Capacity

Set the base directory (parent) for where the shards folder will be placed. The 
shards stores other nodes data shards, so be sure you set this to where you 
intend to store farmed shards.

```
ShardStorageBaseDir = /home/bookchin/.config/orc
```

Define the maximum size you wish to allocate for farming shards. This can be 
increased later, but decreasing it will not delete existing data.

```
ShardStorageMaxAllocation = 5GB
```

### Fine Tune Farmer Behavior

How often a farmer profile should scan contract database to reap expired 
shards it is storing.

```
ShardReaperInterval = 24HR
```

How often a farmer profile should publish a capacity announcement to it's
neighboring nodes.

```
CapacityAnnounceInterval = 15M
```
