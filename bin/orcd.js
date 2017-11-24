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
const orc = require('../index');
const options = require('./config');
const config = require('rc')('orcd', options);
const kad = require('kad');
const mongodb = require('mongodb-bin-wrapper');
const mongodargs = [
  '--port', config.MongoDBPort,
  '--dbpath', config.MongoDBDataDirectory
];


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
program.parse(process.argv);

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
    ]
  });

  // Start mongod
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
    logger.error(err.message);
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

  // TODO: Shutdown Zcash cleanly on exit

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
    protocol: orc.version.protocol
  };

  // Initialize protocol implementation
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

  if (parseInt(config.BridgeEnabled)) {
    let opts = {
      stage: config.BridgeTempStagingBaseDir,
      database,
      providerCapacityPoolTimeout: ms(config.ProviderCapacityPoolTimeout),
      providerFailureBlacklistTimeout: ms(config.ProviderFailureBlacklistTimeout)
    };

    if (parseInt(config.BridgeAuthenticationEnabled)) {
      opts.auth = {
        user: config.BridgeAuthenticationUser,
        pass: config.BridgeAuthenticationPassword
      };
    }

    bridge = new orc.Bridge(node, opts);

    logger.info(
      'establishing local bridge at ' +
      `${config.BridgeHostname}:${config.BridgePort}`
    );
    bridge.listen(parseInt(config.BridgePort), config.BridgeHostname);

    if (parseInt(config.BridgeOnionServiceEnabled)) {
      // TODO: Create HSv3
    }
  }

  // Plugin bandwidth metering if enabled
  if (!!parseInt(config.BandwidthAccountingEnabled)) {
    node.plugin(hibernate({
      limit: config.BandwidthAccountingMax,
      interval: config.BandwidthAccountingReset,
      reject: ['CLAIM', 'FIND_VALUE', 'STORE', 'CONSIGN']
    }));
  }

  // TODO Move this logic somewhere else where it is better tested
  // Use verbose logging if enabled
  if (!!parseInt(config.VerboseLoggingEnabled)) {
    node.rpc.deserializer.append(new orc.logger.IncomingMessage(logger));
    node.rpc.serializer.prepend(new orc.logger.OutgoingMessage(logger));
  }

  let retry = null;

  function joinNetwork() {
    return new Promise((resolve, reject) => {
      let entry = null;

      logger.info(
        `joining network from ${config.NetworkBootstrapNodes.length} seeds`
      );
      async.detectSeries(config.NetworkBootstrapNodes, (seed, done) => {
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
      }, async (err, result) => {
        if (!result) {
          logger.error('failed to join network, will retry in 1 minute');
          retry = setTimeout(() => join(callback), ms('1m'));
        } else {
          logger.info(
            `connected to network via ${entry[0]} ` +
            `(http://${entry[1].hostname}:${entry[1].port})`
          );
          logger.info(`discovered ${node.router.size} peers from seed`);
          node.logger.info('subscribing to network capacity announcements');

          node.subscribeCapacityAnnouncement((err, rs) => {
            rs.on('data', (data) => node.updateProviderCapacity(data));
          });

          if (!ms(config.ShardCapacityAnnounceInterval)) {
            setInterval(async () => await node.announceCapacity(),
              ms(config.ShardCapacityAnnounceInterval));
            await node.announceCapacity();
          }

          if (!ms(config.ShardReaperInterval)) {
            setInterval(async () => await node.reapExpiredShards(),
              ms(config.ShardReaperInterval));
          }

          resolve();
        }
      });
    });
  }

  logger.info('bootstrapping tor and establishing hidden service');
  node.listen(parseInt(config.NodeListenPort), async () => {
    logger.info(
      `node listening on local port ${config.NodeListenPort} ` +
      `and exposed at ${node.contact.hostname}:${node.contact.port}`
    );

    config.NetworkBootstrapNodes = config.NetworkBootstrapNodes.concat(
      await node.getBootstrapCandidates()
    );

    await joinNetwork();
  });
}

_init();
