'use strict';

const ms = require('ms');
const { Readable: ReadableStream } = require('stream');
const { EventEmitter } = require('events');
const mongoose = require('mongoose');
const { Schema, createConnection } = mongoose;
const utils = require('./utils');
const secp256k1 = require('secp256k1');
const { utils: keyutils } = require('kad-spartacus');


mongoose.Promise = Promise;

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
    available: {
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

PeerProfile.set('toObject', {
  transform: function(doc, ret) {
    delete ret._id;
    delete ret.__v;
  }
})

/**
 * Describes a contract between two peers for shard storage
 * @type {object}
 */
const ShardContract = new Schema({
  version: {
    type: Number,
    required: true,
    default: 2
  },
  ownerParentKey: {
    type: String,
    required: true,
    match: new RegExp('^[1-9a-km-zA-HJ-NP-Z]{1,111}$')
  },
  ownerIndex: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
    max: 2147483647
  },
  ownerIdentity: {
    type: String,
    required: true,
    match: new RegExp('[A-Fa-f0-9]{40}$')
  },
  ownerSignature: {
    type: String
  },
  providerParentKey: {
    type: String,
    required: true,
    match: new RegExp('^[1-9a-km-zA-HJ-NP-Z]{1,111}$')
  },
  providerIndex: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
    max: 2147483647
  },
  providerIdentity: {
    type: String,
    required: true,
    match: new RegExp('[A-Fa-f0-9]{40}$')
  },
  providerSignature: {
    type: String
  },
  shardSize: {
    type: Number,
    required: true,
    min: 0
  },
  shardHash: {
    type: String,
    required: true,
    match: new RegExp('^[0-9a-f]{40}$')
  },
  auditLeaves: [{
    type: String,
    match: new RegExp('[A-Fa-f0-9]$')
  }],
  auditInterval: {
    type: Number,
    required: true,
    default: ms('60H')
  },
  accessPolicies: [{
    type: String
  }],
  fundingDestination: {
    type: String
  },
  _lastAuditTimestamp: {
    type: Date,
    default: Date.now
  },
  _lastFundingTimestamp: {
    type: Date,
    default: Date.now
  }
});

ShardContract.index({ shardHash: 1, providerIdentity: 1, ownerIdentity: 1 });

ShardContract.virtual('isComplete').get(function() {
  const exclude = [
    '_lastFundingTimestamp',
    '_lastAuditTimestamp',
    'fundingDestination'
  ];

  for (let prop in this) {
    if (exclude.includes(prop)) {
      continue;
    } else if (this[prop] === undefined) {
      return false;
    }
  }

  return true;
});

ShardContract.set('toObject', {
  virtuals: false,
  transform: function(doc, ret) {
    delete ret._lastAuditTimestamp;
    delete ret._lastFundingTimestamp;
  }
});

ShardContract.set('toJSON', {
  virtuals: false,
  transform: function(doc, ret) {
    delete ret._lastAuditTimestamp;
    delete ret._lastFundingTimestamp;
  }
});

ShardContract.methods.toBuffer = function() {
  return Buffer.from(this.toJSON());
};

ShardContract.methods.getSigningString = function() {
  const obj = this.toObject();

  delete obj.ownerSignature;
  delete obj.providerSignature;

  return JSON.stringify(obj);
};

ShardContract.methods.signExternal = function(secret) {
  const { signature, recovery } = secp256k1.sign(
    utils.sha256(Buffer.from(this.getSigningString())),
    secret
  );

  return Buffer.concat([Buffer.from([recovery]), signature]);
};

ShardContract.methods.verifyExternal = function(signature, pubkey) {
  return secp256k1.verify(
    utils.sha256(Buffer.from(this.getSigningString())),
    signature,
    pubkey
  );
};

ShardContract.methods.verify = function(actor) {
  const compactSig = Buffer.from(this[`${actor}Signature`], 'base64');
  const recovery = compactSig[0];
  const signature = compactSig.slice(1);
  const message = utils.sha256(Buffer.from(this.getSigningString()));
  const pubkey = secp256k1.recover(message, signature, recovery, true);
  const pubkeyhash = this[`${actor}Identity`];

  return this.verifyExternal(signature, pubkey) &&
    keyutils.toPublicKeyHash(pubkey).toString('hex') === pubkeyhash;
};

ShardContract.methods.sign = function(actor, secret) {
  return this[`${actor}Signature`] = this.signExternal(secret)
    .toString('base64');
};

ShardContract.statics.compare = function(c1, c2) {
  const contract1 = c1.toObject();
  const contract2 = c2.toObject();
  const ignored = [
    'ownerIdentity',
    'ownerParentKey',
    'ownerIndex',
    'ownerSignature',
    'providerIdentity',
    'providerParentKey',
    'providerIndex',
    'providerSignature',
    'fundingDestination'
  ];

  ignored.forEach(function(prop) {
    delete contract1[prop];
    delete contract2[prop];
  });

  return JSON.stringify(contract1) === JSON.stringify(contract2);
};

ShardContract.statics.diff = function(c1, c2) {
  const differs = [];

  c1 = c1.toObject();
  c2 = c2.toObject();

  for (let prop in c1) {
    if (Array.isArray(c1[prop])) {
      if (JSON.stringify(c1[prop]) !== JSON.stringify(c2[prop])) {
        differs.push(prop);
      }
    } else if (c1[prop] !== c2[prop]) {
      differs.push(prop);
    }
  }

  return differs;
};

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
  shards: [Schema.Types.Mixed]
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
    super();

    this.connection = createConnection.call(mongoose, uri, {
      useMongoClient: true
    });

    this.connection.on('error', (err) => this.emit('error', err));
    this.connection.on('open', () => this.emit('open'));

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
    const rs = new ReadableStream({ read: () => null, objectMode: true });
    const cursor = this.model.find({}).cursor();

    cursor
      .on('data', (doc) => {
        rs.push({ key: doc.key, value: doc.toObject() })
      })
      .on('error', (err) => rs.emit('error', err))
      .on('end', () => rs.push(null));
  }

}

module.exports = Database;
module.exports.KadStorageAdapter = KadStorageAdapter;
