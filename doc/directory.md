ORC nodes, by default, run a "directory service", which is disctinct from the 
core RPC service used for P2P communications and the "bridge service" used 
by applications. During the normal operation of the network, nodes maintain 
a persistent record of the identities it has encountered along with various 
metadata.

This metadata includes the last time we interacted with an identity, how much 
storage capacity they have allocated and available, and the last time we 
received a capacity announcement on their behalf. When a node also runs a 
directory service, it leverages this information along with audit reports 
created by the local bridge service to periodically apply a reputation score to 
each identity it knows. This is how each individual node establishes a view of 
reliable nodes in the network and how the bridge service makes selections for 
providers when objects are uploaded.

The directory service, by default, is enabled and public (meaning it does 
require not authentication to be accessed). By default, ORC will also establish 
a distinct hidden service for it. The ORC Project maintains a public directory 
with an API exposed on the clearnet at 
[https://directory.orc.network](https://directory.orc.network). Feel free to 
use it or run your own!

For the purpose of this guide and examples, we will assume the following 
configuration properties are set:

```
DirectoryPort = 4446
DirectoryHostname = 127.0.0.1
DirectoryUseSSL = 0
```
### `GET /`

Fetches a JSON array of all identities and their associated profiles for which 
the node has interacted with in the past 24 hours.

```
$ curl http://127.0.0.1:4446 | jq
[
  {
    "identity": "13989612ba437a43ff1ef186019e12da1c66b7f3",
    "updated": "2017-09-30T17:19:49.230Z",
    "reputation": {
      "timestamp": "2017-09-30T17:19:49.230Z",
      "score": 0
    },
    "capacity": {
      "timestamp": "2017-10-03T15:53:40.353Z",
      "available": 1099511623680,
      "allocated": 1099511627776
    },
    "contact": {
      "xpub": "xpub69p5JPnPnhW3a6Yh4HsUMa6wjUBZA8Vqzy3YGvLUrndK3ZdP6thfU3Uez8evMEBDBDTtyHzaJg2JUYtP3kuATWTcU1bQbzsRcbZm5mBpDeT",
      "port": 443,
      "hostname": "rm4mbpdzhtemijlt.onion",
      "agent": "orc-8.1.1-beta6/linux",
      "index": 0,
      "protocol": "https:"
    }
  }
]
```

### `GET /{identity}`

Given a known identity key, fetch the specific profile associated.

```
$ curl http://127.0.0.1:4446/501e820f0ec3eb0350a239f57062abce1f55da09 | jq
{
  "identity": "501e820f0ec3eb0350a239f57062abce1f55da09",
  "updated": "2017-09-30T17:19:49.226Z",
  "reputation": {
    "timestamp": "2017-09-30T17:19:49.226Z",
    "score": 0
  },
  "capacity": {
    "timestamp": "2017-10-03T15:52:15.148Z",
    "available": 128834753620,
    "allocated": 128849018880
  },
  "contact": {
    "xpub": "xpub69nnJmWgmvSqmkfZMfmsrMby1LSZsZv9HNEFPqfku9Pc9YS4RdcAkqBWjTrrJkgscnLrBg3CwAeZqtfnVV6y419KBUfHpBJf5c8kDXpusxN",
    "port": 443,
    "hostname": "dcqbajwkawiidnwo.onion",
    "agent": "orc-8.1.1-beta6/linux",
    "index": 0,
    "protocol": "https:"
  }
}
```
