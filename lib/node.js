'use strict';

const stream = require('stream');
const url = require('url');
const { createLogger } = require('bunyan');
const merge = require('merge');
const http = require('http');
const kadence = require('@kadenceproject/kadence');
const constants = require('./constants');
const ms = require('ms');
const utils = require('./utils');
const version = require('./version');

const Rules = require('./rules');
const Server = require('./server');
const Transport = require('./transport');
const Database = require('./database');


/**
 * Extends Kademlia with Orc protocol rules
 * @license AGPL-3.0
 */
class Node extends kadence.KademliaNode {

  static get DEFAULTS() {
    return {
      logger: createLogger({ name: 'orcd' }),
      transport: new Transport(),
      privateExtendedKey: null,
      keyDerivationIndex: 1,
      flags: []
    };
  }

  /**
   * @constructor
   * @extends {KademliaNode}
   * @param {object} options
   * @param {string} options.privateExtendedKey - HD extended private key
   * @param {object} [options.logger] - Bunyan compatible logger
   * @param {Transport} [options.transport]
   * @param {Database} options.database
   * @param {Shards} options.shards
   * @param {number} [options.keyDerivationIndex] - HD derivation index
   */
  constructor(options) {
    /* eslint max-statements: [2, 16] */
    const opts = merge(Node.DEFAULTS, options, {
      storage: new Database.KadStorageAdapter(options.database.NetworkBlob)
    });

    super(opts);

    this.flags = opts.flags;
    this.contact.agent = this.contact.agent || version.protocol;
    this.hashcash = this.plugin(kadence.hashcash({
      methods: ['PUBLISH', 'STORE', 'CLAIM'],
      difficulty: 4
    }));
    this.quasar = this.plugin(kadence.quasar());
    this.spartacus = this.plugin(kadence.spartacus(
      options.privateExtendedKey,
      options.keyDerivationIndex,
      constants.HD_KEY_DERIVATION_PATH
    ));
    this.cas = this.plugin(kadence.contentaddress({
      keyAlgorithm: 'rmd160',
      valueEncoding: 'base64'
    }));
    this.database = opts.database;
    this.shards = opts.shards;
    this.server = new Server({
      database: this.database,
      shards: this.shards,
      identity: this.identity
    });

    this.transport.on('identify', (req, res) => {
      this.logger.debug('responding to peer requested identification');
      res.end(JSON.stringify([
        this.identity.toString('hex'),
        this.contact
      ]));
    });
    this.transport.on('download', (req, res) => {
      this.logger.debug('handling shard download request');
      this.server.download(req, res)
    });
    this.transport.on('upload', (req, res) => {
      this.logger.debug('handling shard upload request');
      this.server.upload(req, res)
    });

    this._bootstrap();
  }

  /**
   * @private
   */
  _bootstrap() {
    // Keep a record of the contacts we've seen
    this.router.events.on('add', (identity) => {
      let contact = this.router.getContactByNodeId(identity);
      let capacity = utils.getCapacityFromFlags(contact.flags);

      this.logger.debug(`updating peer profile ${identity}`);
      this.database.PeerProfile.findOneAndUpdate(
        { identity: identity.toString('hex') },
        {
          identity: identity.toString('hex'),
          contact,
          updated: Date.now(),
          capacity
        },
        { upsert: true },
        () => null
      );
    });
  }

  /**
   * Returns a list of bootstrap nodes from local profiles
   * @returns {string[]} urls
   */
  getBootstrapCandidates() {
    return new Promise((resolve, reject) => {
      this.database.PeerProfile.find({
        updated: { $gt: Date.now() - ms('48HR') },
        identity: { $ne: this.identity.toString('hex') }
      }).sort({ updated: -1 }).limit(10).exec((err, profiles) => {
        if (err) {
          this.logger.warn(err.message);
          return reject(err);
        }

        resolve(profiles.map((p) => p.toString()));
      });
    });
  }

  /**
   * Performs any periodic updates to the contact flags we include
   * in every message
   * @param {boolean} soft - Don't do iterativeFindNode on update
   */
  updateFlags(soft) {
    return new Promise((resolve, reject) => {
      this.shards.size((err, data) => {
        /* istanbul ignore if */
        if (err) {
          this.logger.warn('failed to measure capacity');
          return reject(err);
        }

        this.contact.flags = this.flags.concat([
          ['ALLOCATED', data.allocated],
          ['AVAILABLE', data.available]
        ]);

        // Update our own peer profile
        this.database.PeerProfile.findOneAndUpdate(
          { identity: this.identity.toString('hex') },
          {
            contact: this.contact,
            updated: Date.now(),
            capacity: utils.getCapacityFromFlags(this.contact)
          },
          { upsert: true }
        );

        if (soft) {
          return resolve();
        }

        this.iterativeFindNode(this.identity.toString('hex'), () => resolve());
      });
    });
  }

  /**
   * Scans the contract database for stale contracts to reap
   */
  reapExpiredShards(callback = () => null) {
    const decayTime = Date.now() - (constants.SCORE_INTERVAL +
                                    constants.REAPER_GRACE);

    const contractStream = this.database.ShardContract.find({
      _lastAuditTimestamp: { $lt: decayTime },
      _lastAccessTimestamp: { $lt: decayTime },
      _lastFundingTimestamp: { $lt: decayTime },
      providerIdentity: this.identity.toString('hex')
    }).cursor();

    const reaperStream = new stream.Writable({
      objectMode: true,
      write: (contract, enc, next) => {
        this.shards.unlink(contract.shardHash, err => {
          if (err) {
            this.logger.warn(`failed to reap shard, ${err.message}`);
            next();
          } else {
            this.logger.info(`reaped shard ${contract.shardHash}`);
            contract.remove(() => next());
          }
        });
      }
    });

    this.logger.info('starting shard reaper to free unutilized allocation');
    contractStream.pipe(reaperStream)
      .on('finish', () => {
        this.logger.info('finished shard reaper routine');
        callback();
      })
      .on('error', err => {
        this.logger.error(`shard reaper failed, ${err.message}`);
        callback(err);
      });
  }


  /**
   * Adds the kademlia rule handlers before calling super#listen()
   */
  listen() {
    let handlers = new Rules(this);

    this.use(handlers.validate.bind(handlers));
    this.use('AUDIT', handlers.audit.bind(handlers));
    this.use('CONSIGN', handlers.consign.bind(handlers));
    this.use('RETRIEVE', handlers.retrieve.bind(handlers));
    this.use('RENEW', handlers.renew.bind(handlers));
    this.use('CLAIM', handlers.claim.bind(handlers));

    super.listen(...arguments);
  }

  /**
   * Sends a GET request to the URI and parses the result as a valid
   * contact object with identity
   * @param {string} url - The URL of the node
   * @param {Node~identifyServiceCallback} callback
   */
  identifyService(uri, callback) {
    const options = merge(url.parse(uri), {
      agent: this.onion.createClearAgent(),
      method: 'GET'
    });
    const req = http.request(options, (res) => {
      let body = '';

      res.on('error', callback);
      res.on('data', (data) => body += data.toString());
      res.on('end', () => {
        if (res.statusCode !== 200) {
          callback(new Error(body));
        } else {
          try {
            callback(null, JSON.parse(body));
          } catch (err) {
            callback(new Error('Failed to parse identity'));
          }
        }
      });
    });

    req.on('error', callback);
    req.end();
  }
  /**
   * @callback Node~identifyServiceCallback
   * @param {error|null} error
   * @param {array} contact
   */

  /**
   * Requests authorization tokens to pull file shard(s) from another node
   * @param {array} peer
   * @param {string} peer.0 - Identity key string
   * @param {string|object} peer.1 - Address data for contact
   * @param {string[]} hashes - Hashes of the shards to pull
   * @param {Node~authorizeRetrievalCallback} callback
   */
  authorizeRetrieval(peer, hashes, callback) {
    this.send('RETRIEVE', hashes, peer, callback);
  }
  /**
   * @callback Node~authorizeRetrievalCallback
   * @param {error|null} error
   * @param {string[]} retrievalTokens
   */

  /**
   * Requests authorization tokens to push file shard(s) to another node
   * @param {array} peer
   * @param {string} peer.0 - Identity key string
   * @param {string|object} peer.1 - Address data for contact
   * @param {string[]} hashes - Hashes of the shards to push
   * @param {Node~authorizeConsignmentCallback} callback
   */
  authorizeConsignment(peer, hashes, callback) {
    this.send('CONSIGN', hashes, peer, callback);
  }
  /**
   * @callback Node~authorizeConsignmentCallback
   * @param {error|null} error
   * @param {string[]} consignmentTokens
   */

  /**
   * Requests the source node to MIRROR a shard to the supplied destination
   * @param {array} source
   * @param {string} source.0 - Identity key string
   * @param {string|object} source.1 - Address data for contact
   * @param {object} target
   * @param {array} target.destination -
   * @param {string} target.destination.0 - Identity key string
   * @param {string|object} target.destination.1 - Address data for contact
   * @param {string} target.hash - Hash of the shard to mirror
   * @param {string} target.token - Authorization token to PUSH shard
   * @param {Node~createShardMirrorCallback} callback
   */
  createShardMirror(source, target, callback) {
    this.send('MIRROR', [target.hash, target.token, target.destination],
              source, callback);
  }
  /**
   * @callback Node~createShardMirrorCallback
   * @param {object|null} error
   */

  /**
   * Sends the series of hash/challenge pairs to the remote node to request
   * proof-of-storage
   * @param {array} peer
   * @param {string} peer.0 - Identity key string
   * @param {string|object} peer.1 - Address data for contact
   * @param {object[]} audits
   * @param {string} audits.hash - Hash of the shard to prove
   * @param {string} audits.challenge - Challenge string to prepend to shard
   * @param {Node~auditRemoteShardsCallback} callback
   */
  auditRemoteShards(peer, audits, callback) {
    this.send('AUDIT', audits, peer, callback);
  }
  /**
   * @callback Node~auditRemoteShardsCallback
   * @param {object|null} error
   * @param {object[]} proofs
   * @param {string} proofs.hash - Hash of the shard for corresponding proof
   * @param {string} proofs.proof - {@tutorial compact-merkle-proof}
   */

  /**
   * Requests that the target peer update their local version of the given
   * contract. Used to extend storage time or terminate storage. Peer will
   * respond with an error or their updated, signed record of the renewal.
   * @param {array} peer
   * @param {string} peer.0 - Identity key string
   * @param {object} peer.1 - Address data for contact
   * @param {object} contract - The completed shard descriptor contract
   * @param {Node~requestContractRenewalCallback} callback
   */
  requestContractRenewal(peer, descriptor, callback) {
    this.send('RENEW', [descriptor], peer, (err, result) => {
      if (err) {
        return callback(err);
      }

      const contract = new this.database.ShardContract(result[0]);

      if (!(!contract.validateSync() && contract.verify('owner'))) {
        return callback(new Error(
          'Peer replied with invalid or incomplete contract'
        ));
      }

      this.database.ShardContract.findOneAndUpdate({
        shardHash: descriptor.shardHash
      }, result[0], (err) => callback(err, contract));
    });
  }
  /**
   * @callback Node~requestContractRenewalCallback
   * @param {error|null} error
   * @param {object} contract - See {@tutorial storage-contracts}
   */

  /**
   * Claims capacity from a farming node, given a valid contract
   * @param {array} peer
   * @param {string} peer.0 - Identity key string
   * @param {string|object} peer.1 - Address data for contact
   * @param {object} descriptor - Contract descriptor
   * @param {Node~claimProviderCapacityCallback} callback
   */
  claimProviderCapacity(peer, descriptor, callback) {
    this.send('CLAIM', [descriptor], peer, callback);
  }
  /**
   * @callback Node~claimProviderCapacityCallback
   * @param {error|null} error
   * @param {array} result
   * @param {object} result.0 - Completed contract result
   * @param {string} result.1 - Consignment token
   */

  /**
   * Make sure incompatible nodes don't make it into our routing table
   * @private
   */
  _updateContact(identity, contact) {
    try {
      if (!utils.isCompatibleVersion(contact.agent)) {
        return;
      }
    } catch (err) {
      return;
    }

    super._updateContact(...arguments);
  }

}

module.exports = Node;
