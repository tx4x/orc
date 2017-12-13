#!/usr/bin/env node

'use strict';

const async = require('async');
const program = require('commander');
const bytes = require('bytes');
const hdkey = require('hdkey');
const hibernate = require('kad-hibernate');
const spartacus = require('kad-spartacus');
const onion = require('kad-onion');
const ms = require('ms');
const bunyan = require('bunyan');
const RotatingLogStream = require('bunyan-rotating-file-stream');
const fs = require('fs');
const path = require('path');
const orc = require('../index');
const options = require('./config');
const npid = require('npid');
const daemon = require('daemon');


program.version(`
  orc      ${orc.version.software}
  protocol ${orc.version.protocol}
`);

program.description(`
  Copyright (c) 2017 Counterpoint Hackerspace, Ltd
  Copyright (c) 2017 Gordon Hall
  Licensed under the GNU Affero General Public License Version 3
`);

program.option('--config <file>', 'path to a orcd configuration file');
program.option('--datadir <path>', 'path to the default data directory');
program.option('--shutdown', 'sends the shutdown signal to the daemon');
program.option('--daemon', 'sends orcd to the background');
program.parse(process.argv);

let argv;

if (program.datadir && !program.config) {
  argv = { config: path.join(program.datadir, 'config') };
}

const config = require('rc')('orcd', options(program.datadir), argv);
const kad = require('kad');
const mongodb = require('mongodb-bin-wrapper');
const mongodargs = [
  '--port', config.MongoDBPort,
  '--dbpath', config.MongoDBDataDirectory
];

// Extend the Kad T_RESPONSETIMEOUT to 30s because Tor
kad.constants.T_RESPONSETIMEOUT = ms('30S');

let xprivkey, parentkey, childkey, identity, logger, mongod, bridge;

// Generate a private extended key if it does not exist
if (!fs.existsSync(config.PrivateExtendedKeyPath)) {
  fs.writeFileSync(
    config.PrivateExtendedKeyPath,
    spartacus.utils.toHDKeyFromSeed().privateExtendedKey
  );
}

function _init() {
  // Initialize private extended key
  xprivkey = fs.readFileSync(config.PrivateExtendedKeyPath).toString();
  parentkey = hdkey.fromExtendedKey(xprivkey)
                .derive(orc.constants.HD_KEY_DERIVATION_PATH);
  childkey = parentkey.deriveChild(parseInt(config.ChildDerivationIndex));
  identity = spartacus.utils.toPublicKeyHash(childkey.publicKey)
               .toString('hex');

  // Initialize logging
  logger = bunyan.createLogger({
    name: identity,
    streams: [
      {
        stream: new RotatingLogStream({
          path: config.LogFilePath,
          totalFiles: parseInt(config.LogFileMaxBackCopies),
          rotateExisting: true,
          gzip: false
        })
      },
      { stream: process.stdout }
    ],
    level: parseInt(config.VerboseLoggingEnabled) ? 'debug' : 'info'
  });

  if (program.shutdown) {
    try {
      process.kill(parseInt(
        fs.readFileSync(config.DaemonPidFilePath).toString().trim()
      ), 'SIGTERM');
    } catch (err) {
      logger.error('failed to shutdown daemon, is it running?');
      process.exit(1);
    }
    process.exit();
  }

  if (program.daemon) {
    require('daemon')({ cwd: process.cwd() });
  }

  try {
    npid.create(config.DaemonPidFilePath).removeOnExit();
  } catch (err) {
    logger.error('Failed to create PID file, is orcd already running?');
    process.exit(1);
  }

  // Start mongod
  logger.info(`starting mongod with args ${mongodargs}`);
  mongod = mongodb('mongod', mongodargs);

  mongod.stdout.on('data', data => {
    if (data.toString().includes('waiting for connections')) {
      init();
    }
  });

  mongod.stderr.on('data', data => {
    logger.error(data.toString());
  });

  // If mongod exits because then stop
  mongod.on('close', code => {
    if (code !== 0) {
      logger.error(`mongod exited with non-zero code (${code}), stopping orc`);
      process.exit(code);
    }
  });

  // TODO: Start Zcash process
  // TODO: Connect wallet RPC

  // Shutdown children cleanly on exit
  process.on('exit', killChildrenAndExit);
  process.on('SIGTERM', killChildrenAndExit);
  process.on('SIGINT', killChildrenAndExit);
  process.on('uncaughtException', (err) => {
    npid.remove(config.DaemonPidFilePath);
    logger.error(err.message);
    logger.debug(err.stack);
    process.exit(1);
  });
}

function killChildrenAndExit() {
  logger.info('exiting, killing child services');

  if (process.platform === 'linux') {
    mongodb('mongod', mongodargs.concat(['--shutdown']));
  } else {
    process.kill(mongod.pid);
  }

  npid.remove(config.DaemonPidFilePath);
  process.removeListener('exit', killChildrenAndExit);
  process.exit(0);
}

function init() {
  // Initialize the shard storage database
  const shards = new orc.Shards(
    config.ShardStorageDataDirectory,
    { maxSpaceAllocated: bytes.parse(config.ShardStorageMaxAllocation) }
  );

  // Initialize the storage database
  const database = new orc.Database(
    `mongodb://127.0.0.1:${config.MongoDBPort}/orc-${identity}`
  );

  // Initialize transport adapter with SSL
  const transport = new orc.Transport();

  // Initialize public contact data
  const contact = {
    hostname: '127.0.0.1', // NB: Placeholder (kad-onion overrides this)
    protocol: 'http:',
    port: parseInt(config.NodeVirtualPort),
    xpub: parentkey.publicExtendedKey,
    index: parseInt(config.ChildDerivationIndex),
    agent: orc.version.protocol
  };

  // Initialize protocol implementation
  logger.info('initializing orc node');
  const node = new orc.Node({
    database,
    shards,
    logger,
    transport,
    contact,
    privateExtendedKey: xprivkey,
    keyDerivationIndex: parseInt(config.ChildDerivationIndex)
  });

  // Handle any fatal errors
  node.on('error', (err) => {
    logger.error(err.message.toLowerCase());
  });

  // Establish onion hidden service
  node.plugin(onion({
    dataDirectory: config.NodeOnionServiceDataDirectory,
    virtualPort: config.NodeVirtualPort,
    localMapping: `127.0.0.1:${config.NodeListenPort}`,
    torrcEntries: {
      CircuitBuildTimeout: 10,
      KeepalivePeriod: 60,
      NewCircuitPeriod: 60,
      NumEntryGuards: 8,
      Log: `${config.TorLoggingVerbosity} stdout`
    },
    passthroughLoggingEnabled: !!parseInt(config.TorPassthroughLoggingEnabled)
  }));

  let bridgeOpts = {
    stage: config.BridgeTempStagingBaseDir,
    database,
    providerCapacityPoolTimeout: ms(config.ProviderCapacityPoolTimeout),
    providerFailureBlacklistTimeout: ms(config.ProviderFailureBlacklistTimeout)
  };

  if (parseInt(config.BridgeAuthenticationEnabled)) {
    bridgeOpts.auth = {
      user: config.BridgeAuthenticationUser,
      pass: config.BridgeAuthenticationPassword
    };
  }

  bridge = new orc.Bridge(node, bridgeOpts);

  logger.info(
    'establishing local bridge at ' +
    `${config.BridgeHostname}:${config.BridgePort}`
  );
  bridge.listen(parseInt(config.BridgePort), config.BridgeHostname);

  // Plugin bandwidth metering if enabled
  if (!!parseInt(config.BandwidthAccountingEnabled)) {
    node.plugin(hibernate({
      limit: config.BandwidthAccountingMax,
      interval: config.BandwidthAccountingReset,
      reject: ['CLAIM', 'FIND_VALUE', 'STORE', 'CONSIGN']
    }));
  }

  // Use verbose logging if enabled
  if (!!parseInt(config.VerboseLoggingEnabled)) {
    node.rpc.deserializer.append(new orc.logger.IncomingMessage(logger));
    node.rpc.serializer.prepend(new orc.logger.OutgoingMessage(logger));
  }

  // Cast network nodes to an array
  if (typeof config.NetworkBootstrapNodes === 'string') {
    config.NetworkBootstrapNodes = config.NetworkBootstrapNodes.trim().split();
  }

  async function joinNetwork(callback) {
    let entry = null;
    let peers = config.NetworkBootstrapNodes.concat(
      await node.getBootstrapCandidates()
    );

    if (peers.length === 0) {
      logger.info('no bootstrap seeds provided and no known profiles');
      logger.info('running in seed mode (waiting for connections)');

      return node.router.events.once('add', (identity) => {
        config.NetworkBootstrapNodes = [
          orc.utils.getContactURL([
            identity,
            node.router.getContactByNodeId(identity)
          ])
        ];
        joinNetwork(callback)
      });
    }

    logger.info(`joining network from ${peers.length} seeds`);
    async.detectSeries(peers, (seed, done) => {
      logger.info(`requesting identity information from ${seed}`);
      node.identifyService(seed, (err, contact) => {
        if (err) {
          logger.error(`failed to identify seed ${seed} (${err.message})`);
          done(null, false);
        } else {
          entry = contact;
          node.join(contact, (err) => {
            done(null, (err ? false : true) && node.router.size > 1);
          });
        }
      });
    }, (err, result) => {
      if (!result) {
        logger.error('failed to join network, will retry in 1 minute');
        callback(new Error('Failed to join network'));
      } else {
        callback(null, entry);
      }
    });
  }

  logger.info('bootstrapping tor and establishing hidden service');
  node.listen(parseInt(config.NodeListenPort), () => {
    logger.info(
      `node listening on local port ${config.NodeListenPort} ` +
      `and exposed at http://${node.contact.hostname}:${node.contact.port}`
    );

    if (ms(config.ShardCapacityUpdateInterval)) {
      setInterval(() => node.updateFlags(),
        ms(config.ShardCapacityUpdateInterval));
    }

    if (ms(config.ShardReaperInterval)) {
      setInterval(() => node.reapExpiredShards(),
        ms(config.ShardReaperInterval));
    }

    database.PeerProfile.findOneAndUpdate(
      { identity: identity.toString('hex') },
      {
        identity: identity.toString('hex'),
        contact: contact,
        updated: Date.now(),
        capacity: orc.utils.getCapacityFromFlags(contact.flags)
      },
      { upsert: true },
      () => null
    );

    node.updateFlags(true);
    async.retry({
      times: Infinity,
      interval: 60000
    }, done => joinNetwork(done), (err, entry) => {
      if (err) {
        logger.error(err.message);
        process.exit(1);
      }

      logger.info(
        `connected to network via ${entry[0]} ` +
        `(http://${entry[1].hostname}:${entry[1].port})`
      );
      logger.info(`discovered ${node.router.size} peers from seed`);
      setInterval(() => bridge.audit(), orc.constants.AUDIT_INTERVAL);
    });
  });
}

_init();
