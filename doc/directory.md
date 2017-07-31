Directories are "passive" ORC nodes that hang around the network and relay 
publications for farmers and renters. During this process, directories maintain 
a cache of all the farmers it has seen, their service contact information and 
the available and allocated capacity they have. Using this cache, directories 
expose an API (optionally over the clearnet) to aid applications in gaining 
valuable insight into the state of the network.

The ORC Project maintains a public directory node with an API exposed at 
[https://directory.orc.network](https://directory.orc.network). Feel free to 
use it or run your own!

If you wish to run your own, this guide will show you how to properly configure 
your node. This will only cover configuration specific to running a directory, 
so for more information be sure to check out the {@tutorial config}.

### Set Location for Directory Data

Set the base directory (parent) for where the directory.db folder will be 
placed. The directory.db holds key-value pairs for the distributed hash 
table, which serve various purposes such as reputation data on other peers.

```
DirectoryStorageBaseDir = /home/bookchin/.config/orc
DirectoryCapacityCachePath = /home/bookchin/.config/orc/capacity.cache
```

### Enable the Directory Profile

Directory profiles collect network statistics and expose a clearnet API for 
fetching that data.

```
ProfilesEnabled[] = directory
```

### Listen for Publication Topics

Topic codes used when running a renter profile for listening for capacity 
announcements from the network. See the protocol specification for more 
details. It is mostly reccommended to leave these at their default values.

```
DirectoryListenTopics[] = 01020202
DirectoryListenTopics[] = 02020202
DirectoryListenTopics[] = 03020202
```

### Configure Directory API

When the directory profile is enabled, use the supplied hostname, port, and 
optional SSL configuration to serve a public (clearnet) statistics API.

```
DirectoryPort = 4446
DirectoryHostname = 127.0.0.1
DirectoryUseSSL = 0
DirectoryServiceKeyPath: /home/bookchin/.config/orc/directory_key.pem
DirectoryCertificatePath: /home/bookchin/.config/orc/directory_cert.pem
DirectoryAuthorityChains[] = /home/bookchin/.config/fullchain.pem
```

