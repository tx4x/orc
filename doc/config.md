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
Below is an complete outline of each valid configuration property name, it's 
behavior, and default value(s). Valid configuration files may be in either INI 
or JSON format.

#### PrivateExtendedKeyPath

##### Default: `$HOME/.config/orc/x_private_key`

Path to private extended key file to use for master identity.
Generate one with:

```
orctool generate-key --extended >> x_private_key
```

#### ChildDerivationIndex

##### Default: `0`

The index for deriving this child node's identity. This allows you to run 
multiple nodes with the same private extended key. If your private extended 
key was converted from an old non-hierarchically-deterministic private key,
you must set the value to `-1`.

#### MongoDBDataDirectory

##### Default: `$HOME/.config/orc/data`

Sets the directory to store MongoDB database files.

#### MongoDBPort

##### Default: `37017`

Sets the TCP port to binding the `mongod` process.

#### ShardStorageBaseDir

##### Default: `$HOME/.config/orc`

Set the base directory (parent) for where the `shards` folder will be 
placed. This directory stores other nodes' data shards, so be sure you set 
this to where you intend to provide capacity.

#### ShardReaperInterval

##### Default: `24HR`

How often we should scan contract database to reap expired shards it is 
storing. Accepts human-readable strings like `3DAYS` or `72HOURS`

#### ShardCapacityAnnounceInterval

##### Default: `15M`

How often we should publish a capacity announcement to neighboring nodes.

#### ShardStorageMaxAllocation

##### Default: `5GB`

Define the maximum size you wish to allocate for farming shards. This can be 
increased later, but decreasing it will not delete existing data.

#### DirectoryEnabled

##### Default: `1`

When enabled, runs the directory service (see {@tutorial directory}). This 
service is responsible for tracking peers over time and scoring audit reports 
for reputation consensus with other directories. Set to `0` to disable.

#### DirectoryPort

##### Default: `4446`

The TCP port to which the directory service should be bound.

#### DirectoryHostname

##### Default: `127.0.0.1`

The hostname or IP address to which the directory service should be bound.

#### DirectoryUseSSL

##### Default: `1`

Enables the use of SSL for the service's HTTP API.

#### DirectoryServiceKeyPath

##### Default: `$HOME/.config/orc/directory_key.pem`

Path on the filesystem to the PEM formatted SSL private key for the directory
service. If this path does not exist, it will be created.

#### DirectoryCertificatePath

##### Default: `$HOME/.config/orc/directory_cert.pem`

Path on the filesystem to the PEM formatted SSL certificate for the directory 
service. If this path does not exist it will be created.

#### DirectoryAuthorityChains[]

##### Default: ` `

A list of paths on the filesystem to PEM formatted certificate authorities for 
the directory service.

#### DirectoryOnionServiceEnabled

##### Default: `0`

Establish a Tor Hidden Service for the directory service's HTTP API.

#### DirectoryOnionServicePrivateKeyPath

##### Default: `$HOME/.config/orc/directory_key`

Path to the RSA-1024 private key used for the onion service. If this path does 
not exist, it will be created.

#### DirectoryBootstrapService

##### Default: `https://orcucqxc54fkhupb.onion:443`

URL for an accessible directory service to use for initial directory 
bootstrapping.

#### TransportMessageResponseTimeout

##### Default: `10S`

How long we should wait on a response back from a peer for any given message.

#### TransportServiceKeyPath

##### Default: `$HOME/.config/orc/service_key.pem`

Path to this node's RPC service's SSL private key. If this path does 
not exist, it will be created. You can also manually generate one with the 
following:

```
orctool generate-cert | csplit - 28
mv xx00 service_key.pem
mv xx01 certificate.pem
```

#### TransportCertificatePath

##### Default: `$HOME/.config/orc/certificate.pem`

Path to this node's RPC service's SSL certificate. If this path does 
not exist, it will be created.

#### OnionServicePrivateKeyPath

##### Default: `$HOME/.config/orc/onion_key`

Path to this node's RSA1024 Tor hidden service private key. If this path does 
not exist, it will be automatically generated for you. If you'd like to 
generate one yourself, you can use:

```
orctool generate-onion >> onion_key
```

#### PublicPort

##### Default: `443`

Sets the virtual port number for your node's RPC onion service.

#### ListenPort

##### Default: `4443`

Sets the local port to bind the node's RPC service.

#### BandwidthAccountingEnabled

##### Default: `0`

Enables bandwidth metering and hibernation mode. When the property 
BandwidthAccountingEnabled is `1`, we will enter low-bandwidth mode if the we
exceed `BandwidthAccountingMax` within the period defined by 
`BandwidthAccountingReset` until the interval is finished.

#### BandwidthAccountingMax

##### Default: `5GB`

Sets the maximum number of bandwidth to use per accounting interval for data 
transfer. Low-bandwidth RPC messages will still be allowed.

#### BandwidthAccountingReset

##### Default: `24HR`

Resets the bandwidth accounting on an interval defined by this property.

#### VerboseLoggingEnabled

##### Default: `1`

More detailed logging of messages sent and received. Useful for debugging.

#### LogFilePath

##### Default: `$HEAD/.config/orcd.log`

Path to write the daemon's log file. Log file will rotate either every 24 hours 
or when it exceeds 10MB, whichever happens first.

#### LogFileMaxBackCopies

##### Default: `3`

Maximum number of rotated log files to keep.

#### ControlPort

##### Default: `4444`

Sets the port to bind the control interface. Used for controlling the 
node from other applications. Be sure that `ControlHostname` is kept set to 
a loopback address, unless you have taken other measures to prevent others 
from controlling your node.

> **Protip!** You can change this to an absolute path to a UNIX domain socket 
> too (in which case `ControlHostname` is ignored).

#### ControlHostname

##### Default: `127.0.0.1`

The hostname or IP address to which the control socket should be bound.

#### NetworkBootstrapNodes[]

##### Default: `https://orcjfg52ty6ljv54.onion:443`
##### Default: `https://orcjd7xgshpovm6i.onion:443`
##### Default: `https://orce4nqoa6muz3gt.onion:443`
##### Default: `https://orcwfkilxjxo63mr.onion:443`

Add a map of network bootstrap nodes to this section to use for discovering 
other peers. Default configuration should come with a list of known and 
trusted contacts.

#### ServiceAvailabilityCheckInterval

##### Default: `10M`

Perform a self test for service availability every so often. If the check 
fails, re-establish service and switch to new Tor circuits

#### BridgeEnabled

##### Default: `1`

Enables the local bridge service, allowing other applications to manage, store, 
retrieve, and share objects on the ORC network. This is the primary programming 
interface exposed by ORC. See {@tutorial transfers} for more information.

#### BridgeHostname

##### Default: `127.0.0.1`

Sets the hostname or IP address to which the bridge service should be bound. It 
is important to set this value to a loopback address if authentication is 
disabled to prevent others from accessing your objects.

#### BridgePort

##### Default: `4445`

Set the TCP port to which the bridge service's HTTP API should be bound.

#### BridgeUseSSL

##### Default: `1`

Enables the use of SSL to secure the bridge service's HTTP API.

#### BridgeServiceKeyPath

##### Default: `$HOME/.config/orc/service_key.pem`

Path to this bridge service's SSL private key. If this path does not exist, it 
will be created. 

#### BridgeCertificatePath

##### Default: `$HOME/.config/orc/certificate.pem`

Path to this bridge service's SSL certificate. If this path does not exist, it 
will be created. 

#### BridgeAuthorityChains[]

##### Default: ` `

Paths to PEM formatted SSL certificate authorities.

#### BridgeAuthenticationEnabled

##### Default: `1`

Force requests to the bridge service API to supply credentials using HTTP Basic 
Authentication.

#### BridgeAuthenticationUser

##### Default: `orc`

User name to require using HTTP Basic Authentication.

#### BridgeAuthenticationPassword

##### Default: `<random>`

Password to require using HTTP Basic Authentication.

#### BridgeTempStagingBaseDir

##### Default: `$TMP`

Sets the path on the filesystem to a directory for storing temporary data 
for queued uploads.

#### BridgeOnionServiceEnabled

##### Default: `0`

Establish a Tor Hidden Service for the bridge service's HTTP API. Make sure 
that authentication is enabled if using this option. Set to `1` to enable.

#### BridgeOnionServicePrivateKeyPath

##### Default: `$HOME/.config/orc/bridge_key`

Path to this bridge's RSA1024 Tor hidden service private key. If this path does 
not exist, it will be automatically generated for you. If you'd like to 
generate one yourself, you can use:

```
orctool generate-onion >> bridge_key
```

#### PeerCapacityPoolTimeout

##### Default: `24HR`

If we haven't received a relayed capacity announcement from a peer within 
this defined timeframe, remove them from the provider pool until we receive 
an announcement again. Prevents attempting to use providers that are unlikely 
to be available.

#### PeerFailureBlacklistTimeout

##### Default: `6HR`

If we have tried to store a shard with a peer and a failure occurred on the 
provider's end, temporarily remove them from the provider pool for this defined 
amount of time.

#### TorPassthroughLoggingEnabled

##### Default: `0`

Redirects the Tor process log output through ORC's logger for the purpose of 
debugging.

#### TorLoggingVerbosity

##### Default: `notice`

Defines the verbosity level of the Tor process logging. Valid options are: `debug`, `info`, `notice`.
