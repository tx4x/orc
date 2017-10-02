This guide will show you how to get started with running `orcd`! An ORC 
node requires a configuration file to get up and running. The path to this 
file is given to `orcd` when starting a node.

```
orcd --config path/to/orc.config
```

If a configuration file is not supplied, a minimal default configuration is 
automatically created and used, which will generate a private extended key, 
self-signed SSL certificate, and storage for shards, contracts, and directory 
information. All of this data will be created and stored in 
`$HOME/.config/orc`, yielding a directory structure like this:

```
+- ~/.config/orc
  + - x_private_key    (Root/Parent HD identity key)
  + - onion_key        (RSA1024 private key for RPC onion service)
  + - bridge_key       (RSA1024 private key for bridge onion service)
  + - directory_key    (RSA1024 private key for directory onion service)
  + - config           (INI configuration file)
  + - service_key.pem  (SSL private key used for all services)
  + - certificate.pem  (SSL certificate used for all services)
  + - /shards          (Directory containing encrypted shards named by hash)
  + - /data            (MongoDB data directory)
```

The locations of all of these files is defined in your configuration file. 
Below is a complete sample config in INI format (though JSON is also 
supported). Comments are inline to describe each property.

### Default Configuration

```ini
;
; ORC Sample Configuration
;

; Path to private extended key file to use for master identity.
; Generate one with:
; 
;   orctool generate-key --extended >> x_private_key
;
PrivateExtendedKeyPath = /home/bookchin/.config/orc/x_private_key

; The index for deriving this child node's identity. This allows you to run 
; multiple nodes with the same private extended key. If your private extended 
; key was converted from an old non-hierarchically-deterministic private key,
; you must set the value to -1
ChildDerivationIndex = 0

; Set the directory to store database and the port that MongoDB should use 
; to accept connections
MongoDBDataDirectory = /home/bookchin/.config/orc/data
MongoDBPort = 37017

; Set the base directory (parent) for where the shards folder will be 
; placed. The shards stores other nodes data shards, so be sure you set 
; this to where you intend to store farmed shards.
ShardStorageBaseDir = /home/bookchin/.config/orc

; How often we should scan contract database to reap expired shards it is 
; storing.
ShardReaperInterval = 24HR

; How often we should publish a capacity announcement to neighboring nodes.
ShardCapacityAnnounceInterval = 15M

; Define the maximum size you wish to allocate for farming shards. This can be 
; increased later, but decreasing it will not delete existing data.
ShardStorageMaxAllocation = 0GB

; Set the base directory (parent) for where the directory.db folder will be 
; placed. The directory.db holds key-value pairs for the distributed hash 
; table, which serve various purposes such as reputation data on other peers.
; In addition, if the directory profile is enabled, use the supplied hostname, 
; port, and optional SSL configuration to serve a public (clearnet) statistics 
; API.
DirectoryEnabled = 1
DirectoryPort = 4446
DirectoryHostname = 127.0.0.1
DirectoryUseSSL = 1
DirectoryServiceKeyPath: /home/bookchin/.config/orc/directory_key.pem
DirectoryCertificatePath: /home/bookchin/.config/orc/directory_cert.pem
;DirectoryAuthorityChains[] = /home/bookchin/.config/fullchain.pem
DirectoryOnionServiceEnabled=1
DirectoryOnionServicePrivateKeyPath=/home/bookchin/.config/orc/directory_key
DirectoryBootstrapService = https://orcucqxc54fkhupb.onion:443

; Paths to this node's SSL key and certificat. If you don't have one, you can 
; generate one with the following:
;
;   orctool generate-cert | csplit - 28
;   mv xx00 service_key.pem
;   mv xx01 certificate.pem
;
TransportServiceKeyPath = /home/bookchin/.config/orc/service_key.pem
TransportCertificatePath = /home/bookchin/.config/orc/certificate.pem

; Path to this node's RSA1024 Tor hidden service private key. If this path does 
; not exist, it will be automatically generated for you. If you'd like to 
; generate one yourself, you can use:
;
;   orctool generate-onion >> onion_key
;
OnionServicePrivateKeyPath = /home/bookchin/.config/orc/onion_key

; Set the public port number at which your node will be reachable to others. 
; This should be the port you forwarded.
PublicPort = 443

; Set the local port to bind the node service.
ListenPort = 4443

; Enables bandwidth metering and hibernation mode. When the property 
; BandwidthAccountingEnabled is 1, we will enter low-bandwidth mode if the we
; exceed BandwidthAccountingMax within the period defined by the property 
; BandwidthAccountingReset until the interval is finished
BandwidthAccountingEnabled = 0
BandwidthAccountingMax = 5GB
BandwidthAccountingReset = 24HR

; Set to 1 for more detailed logging, which is useful for debugging
VerboseLoggingEnabled = 1

; Set the ControlPort to bind the control interface. Used for controlling the 
; node from other applications. Be sure that ControlHostname is kept set to 
; a loopback address, unless you have taken other measures to prevent others 
; from controlling your node.
ControlPort = 4444
ControlHostname = 127.0.0.1

; Add a map of network bootstrap nodes to this section to use for discovering 
; other peers. Default configuration should come with a list of known and 
; trusted contacts. Formatted as "https://{onion}:{port}".
NetworkBootstrapNodes[] = https://orcjd7xgshpovm6i.onion:443
NetworkBootstrapNodes[] = https://orcjfg52ty6ljv54.onion:443
NetworkBootstrapNodes[] = https://orce4nqoa6muz3gt.onion:443
NetworkBootstrapNodes[] = https://orcwfkilxjxo63mr.onion:443

; Perform as self test for service availability every so often. If the check 
; fails, re-establish service and switch to new Tor circuits
ServiceAvailabilityCheckInterval = 10M

; When enabled via "renter" profile, bind a local bridge server that allows for
; GET and POST HTTP requests for uploading and downloading files from the 
; network. The bridge will handle encryption and erasure coding for you.
; Optionally, protect the local bridge access using HTTP Basic Authentication
; credentials defined here.
BridgeEnabled = 1
BridgeHostname = 127.0.0.1
BridgePort = 4445
BridgeUseSSL = 0
BridgeServiceKeyPath = /home/bookchin/.config/orc/service_key.pem
BridgeCertificatePath = /home/bookchin/.config/orc/certificate.pem
BridgeAuthorityChains[] = /home/bookchin/.config/orc/fullchain.pem
BridgeAuthenticationEnabled = 0
BridgeAuthenticationUser = orc
BridgeAuthenticationPassword = 1b5d3daa16b3343560bcf0377547b1c0
BridgeTempStagingBaseDir = /home/bookchin/.config/orc/__bridge.staging
BridgeOnionServiceEnabled=1
BridgeOnionServicePrivateKeyPath=/home/bookchin/.config/orc/bridge_key
```
