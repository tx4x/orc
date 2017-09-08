'use strict';

const ms = require('ms');
const { Readable: ReadableStream } = require('stream');
const { EventEmitter } = require('events');
const mongoose = require('mongoose');
const { Schema, createConnection } = mongoose;
const utils = require('./utils');
const secp256k1 = require('secp256k1');
const { utils: keyutils } = require('kad-spartacus');
const crypto = require('crypto');


mongoose.Promise = Promise;

/**
 * Describes a known network peer
 * @type {object}
 */
const PeerProfile = new Schema({
  identity: {
    type: String,
    required: true,
    unique: true,
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
      type: Number,
      default: 0
    },
    available: {
      type: Number,
      default: 0
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  reputation: {
    score: {
      type: Number,
      default: 0,
      min: 0
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  updated: {
    type: Date,
    default: Date.now
  },
  _reports: {
    missed: {
      type: Number,
      default: 0
    },
    streak: {
      type: Number,
      default: 0
    }
  }
});

PeerProfile.set('toObject', {
  transform: function(doc, ret) {
    delete ret._id;
    delete ret.__v;
    delete ret._reports;
  }
});

PeerProfile.methods.toString = function() {
  return [
    this.contact.protocol, '//', this.contact.hostname, ':', this.contact.port
  ].join('');
};

/**
 * Describes the result of an audit as a report to directories
 * @type {object}
 */
const AuditReport = new Schema({
  reporter: {
    type: String,
    required: true,
    match: new RegExp('[A-Fa-f0-9]{40}$')
  },
  provider: {
    type: String,
    required: true,
    match: new RegExp('[A-Fa-f0-9]{40}$')
  },
  challenge: {
    type: String,
    required: true
  },
  expected: {
    type: String,
    required: true,
    match: new RegExp('[A-Fa-f0-9]{40}$')
  },
  actual: {
    type: String,
    required: true,
    match: new RegExp('[A-Fa-f0-9]{40}$')
  }
});

AuditReport.virtual('outcome').get(function() {
  return this.expected === this.actual ? 1 : 0;
});
AuditReport.methods.toCompressedAuthenticated = function(privateKey) {
  let compressed, { signature, recovery } = secp256k1.sign(
    utils.sha256(Buffer.from(this.getSigningArray().join(''), 'hex')),
    privateKey
  );

  signature = Buffer.concat([Buffer.from([recovery]), signature]);
  compressed = this.getSigningArray();

  compressed.push(signature.toString('base64'));

  return compressed;
};

AuditReport.methods.getSigningArray = function() {
  return [
    this.reporter, this.provider, this.challenge, this.expected, this.actual
  ];
};

AuditReport.statics.verifyCompressedAuthenticated = function(compressed) {
  const report = new this({
    reporter: compressed[0],
    provider: compressed[1],
    challenge: compressed[2],
    expected: compressed[3],
    actual: compressed[4]
  });

  if (!report.validateSync()) {
    return false;
  }

  const compactSig = Buffer.from(compressed[5], 'base64');
  const recovery = compactSig[0];
  const signature = compactSig.slice(1);
  const message = utils.sha256(Buffer.from(report.getSigningArray().join('')));
  const pubkey = secp256k1.recover(message, signature, recovery, true);
  const pubkeyhash = report.reporter;

  return secp256k1.verify(message, signature, pubkey) &&
    keyutils.toPublicKeyHash(pubkey).toString('hex') === pubkeyhash;
};

AuditReport.statics.create = function(data, callback) {
  const report = new this(data);
  report.save(callback);
};

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
    type: String,
    default: 'none'
  },
  _lastAuditTimestamp: {
    type: Date,
    default: Date.now
  },
  _lastFundingTimestamp: {
    type: Date,
    default: Date.now
  },
  _lastAccessTimestamp: {
    type: Date,
    default: Date.now
  }
});

ShardContract.index({ shardHash: 1, providerIdentity: 1, ownerIdentity: 1 });

ShardContract.set('toObject', {
  virtuals: false,
  transform: function(doc, ret) {
    delete ret._lastAuditTimestamp;
    delete ret._lastAccessTimestamp;
    delete ret._lastFundingTimestamp;
    delete ret._id;
    delete ret.__v;
  }
});

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

ShardContract.TYPE_GROUP = 'G';
ShardContract.TYPE_USER = 'U';

ShardContract.methods.checkAccessPolicy = function(contact) {
  let [identity, info] = contact;
  let allowed = [];

  if (this.ownerIdentity === identity || this.ownerParentKey === info.xpub) {
    return ['CONSIGN', 'RETRIEVE', 'RENEW', 'AUDIT', 'MIRROR'];
  }

  for (let p = 0; p < this.accessPolicies.length; p++) {
    let policy = this.accessPolicies[p].split(':');
    let [type, key, permissions] = policy;

    if (!type && !key) {
      allowed = allowed.concat(permissions.split(','));
    }

    if (type === ShardContract.TYPE_GROUP && key === info.xpub) {
      allowed = allowed.concat(permissions.split(','));
    }

    if (type === ShardContract.TYPE_USER && key === identity) {
      allowed = allowed.concat(permissions.split(','));
    }
  }

  return allowed;
};

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
  shards: [{
    size: {
      type: Number,
      required: true,
      min: 1
    },
    hash: {
      type: String,
      required: true
    },
    service: [Schema.Types.Mixed],
    decayed: {
      type: Boolean,
      default: false
    },
    audits: {
      root: {
        type: String
      },
      challenges: [{
        type: String
      }],
      depth: {
        type: Number
      }
    }
  }],
  ecpub: {
    type: String,
    min: 64,
    max: 66
  },
  ecprv: {
    type: String,
    min: 64,
    max: 64
  },
  policies: [{
    type: String
  }],
  _lastAuditTimestamp: {
    type: Date,
    default: Date.now
  },
  _isOwner: {
    type: Boolean,
    default: true
  }
});

ObjectPointer.index({ uuid: 1 });

ObjectPointer.set('toObject', {
  transform: (doc, ret) => {
    delete ret._id;
    delete ret.__v;
    delete ret._lastAuditTimestamp;
    delete ret._isOwner;
    delete ret.ecprv;
    ret.id = doc._id;
    ret.shards = doc.shards.map(s => {
      return {
        size: s.size,
        hash: s.hash,
        service: s.service
      };
    });
  }
});

ObjectPointer.virtual('percentDecayed').get(function() {
  let total = this.shards.length;
  let decayed = this.shards.filter(s => s.decayed).length;

  return decayed / total;
});

ObjectPointer.methods.toEncryptedBlob = function() {
  const password = utils.rmd160sha256(JSON.stringify(this.toObject()));
  const cipher = crypto.createCipher('aes256', password);

  let blob = Buffer.concat([
    cipher.update(JSON.stringify(this.toObject()), 'utf8'),
    cipher.final()
  ]);

  const hash = utils.rmd160(blob);
  const magnet = `magnet:?xt=urn:orc:${hash.toString('hex')}` +
                 `&xs=${this.size}` +
                 `&dn=${this.name}` +
                 `&x.ecprv=${this.ecprv}` +
                 `&x.pword=${password.toString('hex')}`;

  return { blob, hash, magnet };
};

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
    type: String,
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
    delete ret.__v;
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
  constructor(uri) {
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
   * @param {object} [options]
   * @param {function} callback
   */
  get(key, options, callback) {
    /* istanbul ignore else */
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }

    this.model.findOne({ [this.keyName]: key }, (err, doc) => {
      /* istanbul ignore if */
      if (err) {
        return callback(err);
      }

      /* istanbul ignore if */
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
   * @param {object} [options]
   * @param {function} callback
   */
  put(key, value, options, callback) {
    /* istanbul ignore else */
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }

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
      .on('error', (err) => {
        /* istanbul ignore next */
        rs.emit('error', err);
      })
      .on('end', () => rs.push(null));

    return rs;
  }

}

module.exports = Database;
module.exports.KadStorageAdapter = KadStorageAdapter;
