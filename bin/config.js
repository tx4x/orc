'use strict';

const { randomBytes } = require('crypto');
const ini = require('ini');
const { existsSync, writeFileSync } = require('fs');
const mkdirp = require('mkdirp');
const { tmpdir, homedir } = require('os');
const { join } = require('path');

const DEFAULT_DATADIR = join(homedir(), '.config/orcd');

module.exports = function(datadir) {

  datadir = datadir || DEFAULT_DATADIR;

  const options = {

    // Process PID
    DaemonPidFilePath: join(datadir, 'orcd.pid'),

    // Identity/Cryptography
    PrivateExtendedKeyPath: join(datadir, 'x_private_key'),
    ChildDerivationIndex: '0',

    // Database
    MongoDBDataDirectory: join(datadir, 'node_data'),
    MongoDBPort: '37017',

    // Shard Database
    ShardStorageDataDirectory: join(datadir, 'provider_vault'),
    ShardStorageMaxAllocation: '0GB',
    ShardReaperInterval: '24HR',
    ShardReaperInvalidationBlocks: '432',
    ShardCapacityUpdateInterval: '30M',

    // Node Options
    NodeVirtualPort: '80',
    NodeListenPort: '9088',
    NodeOnionServiceDataDirectory: join(datadir, 'node_hs'),

    // Network Bootstrapping
    NetworkBootstrapNodes: [

    ],

    // Bandwidth Metering
    BandwidthAccountingEnabled: '0',
    BandwidthAccountingMax: '5GB',
    BandwidthAccountingReset: '24HR',

    // Debugging/Developer
    VerboseLoggingEnabled: '1',
    LogFilePath: join(datadir, 'orcd.log'),
    LogFileMaxBackCopies: '3',
    TorPassthroughLoggingEnabled: '0',
    TorLoggingVerbosity: 'notice',

    // Local Bridge
    BridgeHostname: '127.0.0.1',
    BridgePort: '9089',
    BridgeAuthenticationEnabled: '1',
    BridgeAuthenticationUser: 'orc',
    BridgeAuthenticationPassword: randomBytes(16).toString('hex'),
    BridgeTempStagingBaseDir: join(datadir, 'tmp'),

    // Additional Bridge Options
    ProviderCapacityPoolTimeout: '48HR',
    ProviderFailureBlacklistTimeout: '12HR',
    ProviderBondDepositAmount: '0',

    // Wallet Options
    WalletDataDirectory: join(datadir, 'z_wallet'),
    WalletHostname: '127.0.0.1',
    WalletPort: '9090',
    WalletAuthenticationUser: 'orc',
    WalletAuthenticationPassword: randomBytes(16).toString('hex')

  };

  if (!existsSync(join(datadir, 'config'))) {
    mkdirp.sync(datadir);
    writeFileSync(join(datadir, 'config'), ini.stringify(options));
  }

  if (!existsSync(join(datadir, 'node_data'))) {
    mkdirp.sync(join(datadir, 'node_data'));
  }

  if (!existsSync(join(datadir, 'provider_vault'))) {
    mkdirp.sync(join(datadir, 'provider_vault'));
  }

  return options;
};
