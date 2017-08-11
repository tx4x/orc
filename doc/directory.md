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

