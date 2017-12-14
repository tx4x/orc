'use strict';

const { randomBytes } = require('crypto');
const assert = require('assert');
const async = require('async');
const utils = require('./utils');
const ProofStream = require('./proof');


/**
 * Represents Orc protocol handlers
 */
class Rules {

  /**
   * Constructs a Orc rules instance in the context of a Orc node
   * @constructor
   * @param {Node} node
   */
  constructor(node) {
    this.node = node;
  }

  /**
   * Validates all incoming RPC messages
   * @param {object} request
   * @param {object} response
   */
  validate(request, response, next) {
    try {
      assert(utils.isCompatibleVersion(request.contact[1].agent),
        `Unsupported protocol version ${request.contact[1].agent}`);
    } catch (err) {
      return next(err);
    }

    return next();
  }

  /**
   * Upon receipt of a AUDIT message, the node must look up the contract that
   * is associated with each hash-challenge pair in the payload, prepend the
   * challenge to the shard data, and caclulate the resulting hash, formatted
   * as a compact proof. See {@tutorial compact-proofs}.
   * @param {object} request
   * @param {object} response
   */
  audit(request, response, next) {
    const audits = request.params;

    if (!Array.isArray(audits)) {
      return next(new Error('Invalid audit batch supplied'));
    }

    async.mapSeries(audits, ({ hash, challenge }, done) => {
      this.node.database.ShardContract.findOne({
        shardHash: hash
      }, (err, contract) => {
        if (err || !contract) {
          return done(null, { hash, proof: [] });
        }

        if (!contract.checkAccessPolicy(request.contact).includes('AUDIT')) {
          return next(new Error('Not authorized'));
        }

        if (!challenge) {
          return next(new Error('Invalid challenge supplied'));
        }

        const auditLeaves = contract.auditLeaves;
        const proofStream = new ProofStream(auditLeaves, challenge);

        proofStream.on('error', () => {
          proofStream.removeAllListeners('finish');
          done(null, { hash, proof: [] });
        });

        proofStream.on('finish', () => {
          contract._lastAuditTimestamp = Date.now();

          proofStream.removeAllListeners('error');
          contract.save(() => {
            done(null, { hash, proof: proofStream.getProofResult() });
          });
        });

        this.node.shards.createReadStream(hash, (err, shardStream) => {
          if (err) {
            return done(null, { hash, proof: [] });
          }

          shardStream.pipe(proofStream);
        });
      });
    }, (err, proofs) => response.send(proofs));
  }

  /**
   * Upon receipt of a CONSIGN message, the node must verify that it has a
   * valid storage allocation and contract for the supplied hash and identity
   * of the originator. If so, it must generate an authorization token which
   * will be checked by the shard server before accepting the transfer of the
   * associated shard.
   * @param {object} request
   * @param {object} response
   */
  consign(request, response, next) {
    const [hash] = request.params;
    const { contact } = request;

    this.node.database.ShardContract.findOne({
      shardHash: hash
    }, (err, contract) => {
      if (err || !contract) {
        return next(err || new Error('Contract not found'));
      }

      if (!contract.checkAccessPolicy(request.contact).includes('CONSIGN')) {
        return next(new Error('Not authorized'));
      }

      const token = randomBytes(32).toString('hex');

      this.node.server.accept(token, hash, contact);
      response.send([token]);
    });
  }

  /**
   * Upon receipt of a RETRIEVE message, the node must verify that it is in
   * possession of the shard on behalf of the identity of the originator.
   * If so, it must generate an authorization token which will be checked by
   * the shard server before accepting the transfer of the associated shard.
   * @param {object} request
   * @param {object} response
   */
  retrieve(request, response, next) {
    const [hash] = request.params;
    const { contact } = request;

    this.node.database.ShardContract.findOne({
      shardHash: hash
    }, (err, contract) => {
      if (err || !contract) {
        return next(err || new Error('Contract not found'));
      }

      const token = randomBytes(32).toString('hex');

      this.node.shards.exists(hash, (err, exists) => {
        if (err || !exists) {
          return next(err || new Error('Shard not found'));
        }

        this.node.server.accept(token, hash, contact);
        response.send([token]);
      });
    });
  }

  /**
   * Upon receipt of a RENEW message, the recipient farmer must extend or
   * terminate it's contract based on the new terms supplied by the renter.
   * If the renewal descriptor is valid and complete, the farmer must store
   * the updated version after signing and respond back to the originator
   * with the version containing the updated signature.
   * @param {object} request
   * @param {object} response
   */
  renew(request, response, next) {
    const [descriptor] = request.params;
    const renewal = new this.node.database.ShardContract(descriptor);
    const hash = renewal.shardHash;

    if (!(!renewal.validateSync() && renewal.verify('owner'))) {
      return next(new Error('Descriptor is invalid or incomplete'));
    }

    this.node.database.ShardContract.findOne({
      shardHash: hash
    }, (err, contract) => {
      if (err || !contract) {
        return next(err || new Error('Contract not found'));
      }

      const allowed = [
        'ownerSignature',
        'ownerIdentity',
        'ownerParentKey',
        'ownerIndex',
        'auditLeaves',
        'accessPolicies'
      ];
      const difference = this.node.database.ShardContract.diff(
        contract,
        renewal
      );

      for (let prop of difference) {
        if (!allowed.includes(prop)) {
          return next(new Error(`Rejecting renewal of ${prop}`));
        }
        contract[prop] = renewal[prop];
      }

      contract.sign('provider', this.node.spartacus.privateKey);
      contract.save((err) => {
        if (err) {
          return next(err);
        }

        response.send([contract.toObject()]);
      });
    });
  }

  /**
   * Upon receipt of an `CLAIM` message, nodes must validate the descriptor,
   * then ensure that there is enough available space for the shard. If both
   * checks succeed, then the descriptor is signed and returned along with a
   * consignment token so the initiating renter can immediately upload the
   * data. These messages are generally sent based on information collected
   * when subscribed to farmer capacity publications.
   * @param {object} request
   * @param {object} response
   */
  claim(request, response, next) {
    const [descriptor] = request.params;
    const contract = new this.node.database.ShardContract(descriptor);
    const hash = contract.shardHash;

    if (!contract.verify('owner')) {
      return next(new Error('Invalid shard descriptor'));
    }

    this.node.shards.size((err, result) => {
      if (err || (result.available < contract.shardSize)) {
        return next(new Error('Not enough capacity available'));
      }

      contract.fundingDestination = null;
      contract.providerIdentity = this.node.identity.toString('hex');
      contract.providerParentKey = this.node.contact.xpub;
      contract.providerIndex = this.node.contact.index;
      contract.sign('provider', this.node.spartacus.privateKey);

      if (contract.validateSync()) {
        return next(new Error('Invalid shard descriptor'));
      }

      contract.save((err) => {
        if (err) {
          return next(err);
        }

        const token = randomBytes(32).toString('hex');

        this.node.server.accept(token, hash, request.contact);
        response.send([contract.toObject(), token]);
      });
    });
  }

}

module.exports = Rules;
