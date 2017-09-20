It's easy to configure ORC for providing. Check out the {@tutorial config} for 
an overview of all configuration properties - this guide only covers what is 
needed for providing. This guide also assumes you have properly installed ORC via 
the provided Docker image or have completed the {@tutorial install} guide.

> Note that ORC will provide 5GB to the network without any modification.

### Allocate Storage Capacity

Set the base directory (parent) for where the shards folder will be placed. The 
shards stores other nodes data shards, so be sure you set this to where you 
intend to store shards.

```
ShardStorageBaseDir = /home/bookchin/.config/orc
```

Define the maximum size you wish to allocate for shards. This can be 
increased later, but decreasing it will not delete existing data.

```
ShardStorageMaxAllocation = 5GB
```

### Fine Tune Provider Behavior

How often a provider profile should scan contract database to reap expired 
shards it is storing.

```
ShardReaperInterval = 24HR
```

How often a provider profile should publish a capacity announcement to it's
neighboring nodes.

```
CapacityAnnounceInterval = 15M
```
