'use strict';

const { Readable: ReadableStream } = require('stream');
const { EventEmitter } = require('events');
const { Schema, createConnection } = require('mongoose');


/**
 * Describes a known network peer
 * @type {object}
 */
const PeerProfile = new Schema({

});

/**
 * Describes a contract between two peers for shard storage
 * @type {object}
 */
const ShardContract = new Schema({

});

/**
 * Record a report of storage audit between two peers
 * @type {object}
 */
const AuditReport = new Schema({

});

/**
 * Keeps references to the location of shards that compose an object
 * @type {object}
 */
const ObjectPointer = new Schema({

});

/**
 * Some arbitrary blob of data stored in the DHT
 * @type {object}
 */
const NetworkBlob = new Schema({

});

/**
 * Wraps a MongoDB connection and initializes models
 */
class Database extends EventEmitter {

  static get schemas() {
    return {
      PeerProfile,
      ShardContract,
      AuditReport,
      ObjectPointer,
      NetworkBlob
    };
  }

  /**
   * @constructor
   * @param {string} connectionUri
   * @param {object} options
   */
  constructor(uri, options) {
    this.connection = createConnection(uri, {
      useMongoClient: true
    });

    for (let name in Database.schemas) {
      this[name] = this.connection.model(name, Database.schemas[name]);
    }
  }

}

/**
 * Wraps the supplied model for a kad/levelup compatible interface
 */
class KadStorageAdapter {

  /**
   * @constructor
   * @param {object} databaseModel
   */
  constructor(model) {
    this.model = model;
  }

  /**
   * Get item by key
   * @param {string} key
   * @param {function} callback
   */
  get(key, callback) {
    // TODO
  }

  /**
   * Put item by key
   * @param {string} key
   * @param {object} value
   * @param {function} callback
   */
  put(key, value, callback) {
    // TODO
  }

  /**
   * Delete item by key
   * @param {string} key
   * @param {function} callback
   */
  del(key, callback) {
    // TODO
  }

  /**
   * Returns a readable stream of all items
   * @returns {ReadableStream}
   */
  createReadStream() {
    // TODO
  }

}

module.exports = Database;
module.exports.KadStorageAdapter = KadStorageAdapter;
