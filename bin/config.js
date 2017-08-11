'use strict';

const { randomBytes } = require('crypto');
const ini = require('ini');
const { existsSync, writeFileSync } = require('fs');
const mkdirp = require('mkdirp');
const { tmpdir, homedir } = require('os');
const { join } = require('path');
const datadir = join(homedir(), '.config/orc');

module.exports = {

  // Identity/Cryptography
  PrivateExtendedKeyPath: join(datadir, 'x_private_key'),
  ChildDerivationIndex: '0',

  // Contract Storage
  ContractStorageBaseDir: datadir, // TODO Remove

  // Shard Database
  ShardStorageBaseDir: datadir,
  ShardStorageMaxAllocation: '5GB',
  ShardReaperInterval: '24HR',
  ShardCapacityAnnounceInterval: '15M'

  // Server SSL
  TransportServiceKeyPath: join(datadir, 'service_key.pem'),
  TransportCertificatePath: join(datadir, 'certificate.pem'),

  // Public Addressability
  PublicPort: '443',
  ListenPort: '4443',

  // Network Bootstrapping
  NetworkBootstrapNodes: [
    'https://orcjfg52ty6ljv54.onion:443',
    'https://orce4nqoa6muz3gt.onion:443',
    'https://orcjd7xgshpovm6i.onion:443',
    'https://orcwfkilxjxo63mr.onion:443'
  ],

  // Tor Behavior
  ServiceAvailabilityCheckInterval: '10M',

  // Bandwidth Metering
  BandwidthAccountingEnabled: '0',
  BandwidthAccountingMax: '5GB',
  BandwidthAccountingReset: '24HR',

  // Debugging/Developer
  VerboseLoggingEnabled: '1',
  ControlPort: '4444',
  ControlHostname: '127.0.0.1',

  // Onion Service
  OnionServicePrivateKeyPath: join(datadir, 'onion_key'),

  // Local Bridge
  BridgeEnabled: '1',
  BridgeHostname: '127.0.0.1',
  BridgePort: '4445',
  BridgeUseSSL: '1',
  BridgeOnionServicePrivateKeyPath: join(datadir, 'bridge_key'),
  BridgeServiceKeyPath: join(datadir, 'service_key.pem'),
  BridgeCertificatePath: join(datadir, 'certificate.pem'),
  BridgeAuthorityChains: [],
  BridgeAuthenticationEnabled: '1',
  BridgeAuthenticationUser: 'orc',
  BridgeAuthenticationPassword: randomBytes(16).toString('hex'),
  BridgeMetaStoragePath: join(datadir, 'objects.meta'), // TODO Remove
  BridgeTempStagingBaseDir: join(tmpdir(), 'orc.tmp'),

  // Directory Server
  DirectoryEnabled: '1',
  DirectoryPort: '4446',
  DirectoryHostname: '127.0.0.1',
  DirectoryUseSSL: '1',
  DirectoryOnionServicePrivateKeyPath: join(datadir, 'directory_key'),
  DirectoryServiceKeyPath: join(datadir, 'service_key.pem'),
  DirectoryCertificatePath: join(datadir, 'certificate.pem'),
  DirectoryAuthorityChains: []

};

if (!existsSync(join(datadir, 'config'))) {
  mkdirp.sync(datadir);
  writeFileSync(join(datadir, 'config'), ini.stringify(module.exports));
}
