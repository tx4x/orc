This guide will show you how to get started with running `orcd`! An ORC 
node requires a configuration file to get up and running. The path to this 
file is given to `orcd` when starting a node.

```
orcd --config path/to/orc.config
```

If a configuration file is not supplied, a minimal default configuration is 
automatically created and used, which will generate a private extended key, 
storage for shards, contracts, and network information. All of this data will 
be created and stored in `$HOME/.config/orcd`, yielding a directory structure 
like this:

```
+- ~/.config/orcd
  + - x_private_key    (Root/Parent HD identity key)
  + - config           (INI configuration file)
  + - orcd.log         (Daemon log file, rotated periodically)
  + - /provider_vault  (Directory containing encrypted shards named by hash)
  + - /node_data       (MongoDB data directory)
  + - /node_hs         (Tor + hidden service data directory)
```

The locations of all of these files is defined in your configuration file. 
Below is an complete outline of each valid configuration property name, it's 
behavior, and default value(s). Valid configuration files may be in either INI 
or JSON format.

#### DaemonPidFilePath

##### Default: `$HOME/.config/orcd/orcd.pid`

The location to write the PID file for the daemon.

#### PrivateExtendedKeyPath

##### Default: `$HOME/.config/orcd/x_private_key`

Path to private extended key file to use for master identity.

#### ChildDerivationIndex

##### Default: `0`

The index for deriving this child node's identity. This allows you to run 
multiple nodes with the same private extended key. If your private extended 
key was converted from an old non-hierarchically-deterministic private key,
you must set the value to `-1`.

#### MongoDBDataDirectory

##### Default: `$HOME/.config/orcd/node_data`

Sets the directory to store MongoDB database files.

#### MongoDBPort

##### Default: `37017`

Sets the TCP port to binding the `mongod` process.

#### ShardStorageDataDirectory

##### Default: `$HOME/.config/orcd/provider_vault`

Set the base directory (parent) for where shards will be placed. This directory 
stores other nodes' data shards, so be sure you set this to where you intend to 
provide capacity.

#### ShardReaperInterval

##### Default: `24HR`

How often we should scan contract database to reap expired shards it is 
storing. Accepts human-readable strings like `3DAYS` or `72HOURS`

#### ShardStorageMaxAllocation

##### Default: `0GB`

Define the maximum size you wish to allocate for farming shards. This can be 
increased later, but decreasing it will not delete existing data.

#### ShardReaperInvalidationBlocks

##### Default: `240`

The number of blocks added to chain without payment since a contract was stored
to determine whether or not the data should be reaped.

#### ShardCapacityUpdateInterval

##### Default: `30M`

The frequency interval we update our flags to reflect our available capacity.

#### NodeOnionServiceDataDirectory

##### Default: `$HOME/.config/orcd/node_hs`

The path to the directory to instruct Tor to use for storing hidden service 
keys and other information.

#### NodeVirtualPort

##### Default: `80`

Sets the virtual port number for your node's RPC onion service.

#### NodeListenPort

##### Default: `9088`

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

#### NetworkBootstrapNodes[]

##### Default: `http://z2ybz7kjxjtfiwcervfh376swy4je3ye4yne2atoi727634qzjonk7id.onion:80`

Add a map of network bootstrap nodes to this section to use for discovering 
other peers. Default configuration should come with a list of known and 
trusted contacts.

#### BridgeHostname

##### Default: `127.0.0.1`

Sets the hostname or IP address to which the bridge service should be bound. It 
is important to set this value to a loopback address if authentication is 
disabled to prevent others from accessing your objects.

#### BridgePort

##### Default: `9089`

Set the TCP port to which the bridge service's HTTP API should be bound.

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

##### Default: `$HOME/.config/orcd/tmp`

Sets the path on the filesystem to a directory for storing temporary data 
for queued uploads.

#### ProviderCapacityPoolTimeout

##### Default: `24HR`

If we haven't received a relayed capacity announcement from a peer within 
this defined timeframe, remove them from the provider pool until we receive 
an announcement again. Prevents attempting to use providers that are unlikely 
to be available.

#### ProviderFailureBlacklistTimeout

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

#### [TrustedIdenties]

##### Default: `*=PING,FIND_NODE,FIND_VALUE,STORE,RETRIEVE`

Defines a map of identities to allowed RPC calls. The default policy allows all
nodes to perform RPC calls necessary for discovering peers, storing metadata, and 
downloading public objects.

To establish a full trust policy with another known node, exchange your identity 
keys and add a wildcard policy:

```
b605647afc146760fc15ef7cd59720f1ee7d82e1=*
```

You can also provide a comma-delimited list of methods to allow.
