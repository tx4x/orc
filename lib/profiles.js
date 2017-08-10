/**
 * @module orc/profiles
 */

// TODO Move all of this to bin/orc.js

'use strict';

const async = require('async');
const ms = require('ms');
const Contract = require('./contract');


/**
 * Applies the farmer profile to the supplied node. A farmer publishes capacity
 * announcements, subscribes to contract publications, and reaps stale shards.
 */
class FarmerProfile {

  /**
   * @constructor
   * @param {Node} node
   * @param {object} config
   */
  constructor(node, config) {
    this.node = node;
    this.config = config;
  }

  /**
   * @private
   */
  init() {
    this.announceCapacity();
    setInterval(() => this.announceCapacity(),
                ms(this.config.FarmerAnnounceInterval));
    setInterval(() => this.reapExpiredShards(),
                ms(this.config.FarmerShardReaperInterval));
  }

  /**
   * Announces current storage capacity to neighbors
   * @param {FarmerProfile~announceCapacityCallback} callback
   */
  announceCapacity(callback = () => null) {
    this.node.shards.size((err, data) => {
      /* istanbul ignore if */
      if (err) {
        return this.node.logger.warn('failed to measure capacity');
      }

      // TODO: Consider removing topic codes in favor of a single topic keyword
      async.eachSeries(this.config.FarmerAdvertiseTopics, (topic, next) => {
        this.node.publishCapacityAnnouncement(topic, data, (err) => {
          /* istanbul ignore if */
          if (err) {
            this.node.logger.error(err.message);
            this.node.logger.warn('failed to publish capacity announcement');
          } else {
            this.node.logger.info('published capacity announcement ' +
              `${data.available}/${data.allocated}`
            );
          }
          next();
        });
      }, callback);
    });
  }
  /**
   * @callback FarmerProfile~announceCapacityCallback
   * @param {error|null} error
   */

  /**
   * Scans the contract database for expired shards and reaps them from storage
   * @param {FarmerProfile~reapExpiredShardsCallback} callback
   */
  reapExpiredShards(callback = () => null) {
    // TODO: Reaping should abandon shards that have not been audited within
    // TODO: the last 10-20 scoring intervals
  }
  /**
   * @callback FarmerProfile~reapExpiredShardsCallback
   * @param {error|null} error
   */

}

/**
 * Applies the renter profile to the supplied node. A renter listens for
 * capacity announcements and keeps a cache, exposes a local bridge for
 * upload/download, handles auditing, mirroring, and payments.
 */
class RenterProfile {

  /**
   * @constructor
   * @param {Node} node
   * @param {object} config
   */
  constructor(node, config) {
    this.node = node;
    this.config = config;
  }

  /**
   * @private
   */
  init() {
    this.node.logger.info('subscribing to network capacity announcements');
    this.node.subscribeCapacityAnnouncement(
      this.config.RenterListenTopics,
      (err, rs) => {
        rs.on('data', ([capacity, contact]) => {
          let timestamp = Date.now();
          this.node.capacity.set(contact[0], { capacity, contact, timestamp });
        });
      }
    );
  }

}

/**
 * Applies the farmer profile
 * @function
 * @param {Node} node
 * @param {object} config
 * @returns {FarmerProfile}
 */
module.exports.farmer = function(node, config) {
  return new FarmerProfile(node, config);
};

/**
 * Applies the renter profile
 * @function
 * @param {Node} node
 * @param {object} config
 * @returns {RenterProfile}
 */
module.exports.renter = function(node, config) {
  return new RenterProfile(node, config);
};

/** @private */
module.exports.FarmerProfile = FarmerProfile;

/** @private */
module.exports.RenterProfile = RenterProfile;
