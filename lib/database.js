'use strict';

const { Readable: ReadableStream } = require('stream');
const { EventEmitter } = require('events');
const { Schema, createConnection } = require('mongoose');


/**
 * Describes a known network peer
 * @type {object}
 */
const PeerProfile = new Schema({
  identity: {
    type: String,
    required: true,
    min: 20,
    max: 20
  },
  contact: {
    hostname: {
      type: String,
      required: true
    },
    port: {
      type: Number,
      required: true
    },
    protocol: {
      type: String,
      required: true,
      default: 'https:'
    },
    xpub: {
      type: String,
      required: true
    },
    index: {
      type: Number,
      required: true,
      default: 0
    },
    agent: {
      type: String,
      default: 'unknown'
    }
  },
  capacity: {
    allocated: {
      type: Number
    },
    availabile: {
      type: Number
    },
    timestamp: {
      type: Date
    }
  },
  reputation: {
    score: {
      type: Number
    }
  }
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
  reporter: {
    type: String,
    required: true,
    min: 20,
    max: 20
  },
  provider: {
    type: String,
    required: true,
    min: 20,
    max: 20
  },
  challenge: {
    type: String,
    required: true
  },
  expected: {
    type: Schema.Types.Mixed
  },
  actual: {
    type: Schema.Types.Mixed
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

/**
 * Keeps references to the location of shards that compose an object
 * @type {object}
 */
const ObjectPointer = new Schema({
  uuid: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    default: 'untitled.blob'
  },
  encoding: {
    type: String
  },
  mimetype: {
    type: String,
    default: 'application/octet-stream'
  },
  hash: {
    type: String,
    required: true,
    min: 64,
    max: 64
  },
  size: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    required: true,
    enum: ['finished', 'queued', 'failed']
  },
  shards: [{
    // TODO
  }]
});

ObjectPointer.index({ uuid: 1 });

ObjectPointer.set('toObject', {
  transform: (doc, ret) => {
    delete ret._id;
    delete ret.shards;
  }
});

/**
 * Some arbitrary blob of data stored in the DHT
 * @type {object}
 */
const NetworkBlob = new Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  value: {
    type: Schema.Types.Mixed,
    required: true
  },
  publisher: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now
  }
});

NetworkBlob.index({ key: 1 });

NetworkBlob.set('toObject', {
  transform: (doc, ret) => {
    delete ret._id;
    delete ret.key;
  }
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
  constructor(model, keyName = 'key') {
    this.model = model;
    this.keyName = keyName;
  }

  /**
   * Get item by key
   * @param {string} key
   * @param {function} callback
   */
  get(key, callback) {
    this.model.findOne({ [this.keyName]: key }, (err, doc) => {
      if (err) {
        return callback(err);
      }

      if (!doc) {
        return callback(new Error('Not found'));
      }

      callback(null, doc.toObject());
    });
  }

  /**
   * Put item by key
   * @param {string} key
   * @param {object} value
   * @param {function} callback
   */
  put(key, value, callback) {
    this.model.findOneAndUpdate({ [this.keyName]: key }, value, {
      upsert: true
    }, callback);
  }

  /**
   * Delete item by key
   * @param {string} key
   * @param {function} callback
   */
  del(key, callback) {
    this.model.remove({ [this.keyName]: key }, callback);
  }

  /**
   * Returns a readable stream of all items
   * @returns {ReadableStream}
   */
  createReadStream() {
    const rs = new ReadableStream({ read: () => null });
    const cursor = this.model.find({}).cursor();

    cursor.on('data', (doc) => {
      rs.push({ key: doc.key, value: doc.toObject() })
    });

    cursor.on('error', (err) => rs.emit('error', err));
  }

}

module.exports = Database;
module.exports.KadStorageAdapter = KadStorageAdapter;
