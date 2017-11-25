'use strict';

const constants = require('./constants');
const { EventEmitter } = require('events');
const BusBoy = require('busboy');
const ReedSolomon = require('@ronomon/reed-solomon');
const http = require('http');
const ws = require('ws');
const utils = require('./utils');
const fs = require('fs');
const merge = require('merge');
const express = require('express');
const auth = require('basic-auth');
const crypto = require('crypto');
const { tmpdir } = require('os');
const path = require('path');
const mkdirp = require('mkdirp');
const uuid = require('uuid');
const AuditStream = require('./audit');
const Proof = require('./proof');
const { knuthShuffle } = require('knuth-shuffle');
const stream = require('stream');
const async = require('async');
const ms = require('ms');
const rimraf = require('rimraf');
const { slice } = require('stream-slice');
const BUFFER = require('buffer');
const bytes = require('bytes');
const cors = require('cors');
const url = require('url');
const { utils: keyutils } = require('kad-spartacus');
const concat = require('concat-stream');
const qs = require('querystring');
const jsonrpc = require('jsonrpc-lite');
const serveStatic = require('serve-static');


/**
 * Represents a local HTTP(s) server that abstracts the upload and download
 * of files away to a simple request. Files are encrypted to the given public
 * key, split into shards for erasure codes. Prepped for distribution and
 * queued for storing in the network. Bridge exposes a simple API for getting
 * status of transfers and previously stored objects.
 *
 * GET    /       (List objects as JSON - or serve Web GUI)
 * GET    /{hash} (Download object)
 * DELETE /{hash} (Delete object)
 * POST   /       (Upload object - Multipart)
 *
 * If auth is enabled, then the websocket event stream expects:
 * ?auth={base64(user:pass)} as the query string
 */
class Bridge extends EventEmitter {

  static get DEFAULTS() {
    return {
      auth: {
        user: null,
        pass: null
      },
      tempStagingDirectory: path.join(
        tmpdir(),
        `staging.${crypto.randomBytes(16).toString('hex')}`
      ),
      peerFailureBlacklistTimeout: ms('6HR'),
      peerCapacityPoolTimeout: ms('24HR')
    };
  }

  /**
   * @constructor
   * @param {Node} node
   * @param {object} options
   */
  constructor(node, options) {
    super();

    this.options = merge(Bridge.DEFAULTS, options);
    this.api = express();
    this.node = node;
    this.database = this.node.database;
    this.server = this._createServer(this.api);
    this.wss = new ws.Server({
      server: this.server,
      verifyClient: (info, cb) => this._verifyClient(info, cb)
    });

    /* istanbul ignore else */
    if (!fs.existsSync(this.options.tempStagingDirectory)) {
      mkdirp.sync(this.options.tempStagingDirectory);
    }

    this.server.setTimeout(0);
    this._bindRoutes();
    setInterval(() => this.audit(), constants.AUDIT_INTERVAL);
  }

  /**
   * @private
   */
  _createServer(handler) {
    return http.createServer(handler);
  }

  /**
   * @private
   */
  _verifyClient(info, callback) {
    const { user, pass } = this.options.auth;

    if (user && pass) {
      const creds = auth(info.req);

      if (!creds || !(creds.name === user && creds.pass === pass)) {
        return callback(false, 401, 'Not authorized');
      }
    }

    callback(true);
  }

  /**
   * Listens on the given port and hostname
   * @param {number} port
   * @param {string} hostname
   * @param {function} callback
   */
  listen() {
    this.server.listen(...arguments);
    this.wss.on('connection', () => {
      this.notifyClients('CONNECT_INFO', null, 'Connected', {
        clients: this.wss.clients.size
      });
    });
  }

  /**
   * Sends a state update payload to all connected clients via the websocket
   */
  notifyClients(type, reference, message, data) {
    this.wss.clients.forEach(client => {
      if (client.readyState === ws.OPEN) {
        client.send(JSON.stringify(
          jsonrpc.notification(type, [reference, message, data])
        ));
      }
    });
  }

  /**
   * Creates request router and handler stack
   * @private
   * @returns {function}
   */
  _bindRoutes() {
    // NB: Used for all routes
    this.api.use(cors());
    this.api.use(this.authenticate.bind(this));

    // NB: Generate stats endpoint
    this.api.get('/', (req, res, next) => {
      if (req.accepts('html')) {
        serveStatic(path.join(__dirname, '../web'))(req, res, next);
      } else {
        this.getNodeStatus(req, res, next);
      }
    });

    // NB: Used for peer profiles
    this.api.get('/providers', this.listProfiles.bind(this));
    this.api.get('/providers/:identity', this.getProfile.bind(this));
    this.api.get('/providers/:id/score', this.getReputationImpact.bind(this));

    // NB: Used for manipulating objects
    this.api.get('/objects', this.listObjects.bind(this));
    this.api.get('/objects/:id', this.downloadObject.bind(this));
    this.api.put('/objects/:id', this.retryUploadObject.bind(this));
    this.api.get('/objects/:id/info', this.getObjectInfo.bind(this));
    this.api.get('/objects/:id/magnet', this.getObjectMagnet.bind(this));
    this.api.post('/objects', this.uploadObject.bind(this));
    this.api.put('/objects', this.resolveObject.bind(this));
    this.api.delete('/objects/:id', this.destroyObject.bind(this));

    // NB: Fallthrough to error handler
    this.api.use(this.error.bind(this));
  }

  /**
   * Handles request authentication if defined
   * @param {object} request
   * @param {object} response
   * @param {function} next
   */
  authenticate(req, res, next) {
    const { user, pass } = this.options.auth;
    const error = new Error('Not authorized');

    error.code = 401;

    if (user && pass) {
      const creds = auth(req);

      if (!creds || !(creds.name === user && creds.pass === pass)) {
        res.setHeader('WWW-Authenticate', 'Basic realm="ORC"');
        return next(error);
      }
    }

    next();
  }

  /**
   * Responds to requests with error code and message
   * @param {error} error
   * @param {object} request
   * @param {object} response
   * @param {function} next
   */
  error(err, req, res, next) {
    if (!err) {
      return next();
    }

    res.writeHead(err.code || 500);
    res.write(err.message);
    res.end();
  }

  /**
   * Scans the object database and returns all index entries
   * @param {object} request
   * @param {object} response
   * @param {function} next
   */
  listObjects(req, res) {
    this.database.ObjectPointer.find({}, (err, pointers) => {
      /* istanbul ignore if */
      if (err) {
        res.status(500).send(err.message);
      } else {
        res.status(200).send(pointers.map(o => o.toObject()));
      }
    });
  }

  /**
   * Gets object information by unique ID
   * @param {object} request
   * @param {object} response
   * @param {function} next
   */
  getObjectInfo(req, res, next) {
    this.database.ObjectPointer.findOne({ _id: req.params.id }, (err, obj) => {
      if (err) {
        return next(err);
      }

      if (!obj) {
        return next(new Error('Not found'));
      }

      res.status(200).send(obj.toObject());
    });
  }

  /**
   * Retries the object upload
   * @param {object} request
   * @param {object} response
   * @param {function} next
   */
  retryUploadObject(req, res, next) {
    this.database.ObjectPointer.findOne({ _id: req.params.id }, (err, obj) => {
      /* istanbul ignore if */
      if (err) {
        return next(err);
      }

      if (obj.status === 'finished') {
        return next(new Error('Object is not queued'));
      }

      const ciphertext = path.join(this.options.tempStagingDirectory,
        obj.hash, 'ciphertext');

      this.distribute(ciphertext, obj, (err, object) => {
        if (err) {
          return next(err);
        }

        res.status(201).send(object.toObject());
      });
    });
  }

  /**
   * Queues the object for upload to the network
   * @param {object} request
   * @param {object} response
   * @param {function} next
   */
  uploadObject(req, res, next) {
    const busboy = new BusBoy({ headers: req.headers });
    const objects = [];
    const policies = [];
    const id = uuid.v4();

    busboy.on('field', (name, value) => {
      if (name === 'policy') {
        policies.push(value);
      }
    });

    /* eslint max-params: [2, 5] */
    busboy.once('file', (field, file, name, encoding, mime) => {
      let tmp = path.join(this.options.tempStagingDirectory, id);
      let size = 0;

      try {
        mkdirp.sync(tmp);
      } catch (err) {
        /* istanbul ignore next */
        return next(new Error('Failed to write to staging area, ' +
                              'does ORC have permission?'));
      }

      const hash = crypto.createHash('sha256');
      const hasher = new stream.Transform({
        transform: (data, enc, cb) => {
          size += data.length;
          hash.update(data);
          cb(null, data);
        }
      });

      const {
        publicKey: ecpub,
        privateKey: ecprv
      } = keyutils.toHDKeyFromSeed();
      const writer = fs.createWriteStream(path.join(tmp, 'ciphertext'));
      const cipher = utils.createCipher(ecpub, ecprv);

      objects.push({ name, encoding, mimetype: mime });
      file.pipe(hasher).pipe(cipher).pipe(writer).on('finish', () => {
        const digest = hash.digest('hex');

        try {
          let target = path.join(path.dirname(tmp), digest);

          if (!fs.existsSync(target)) {
            fs.mkdirSync(target);
          }

          fs.renameSync(
            path.join(tmp, 'ciphertext'),
            path.join(target, 'ciphertext')
          );
          rimraf.sync(tmp);
          tmp = target;
        } catch (err) {
          /* istanbul ignore next */
          return next(err);
        }

        const ciphertext = path.join(tmp, 'ciphertext');
        const object = new this.database.ObjectPointer({
          name, encoding, size, policies,
          ecpub: ecpub.toString('hex'),
          ecprv: ecprv.toString('hex'),
          mimetype: mime,
          hash: digest,
          shards: [],
          status: 'queued'
        });

        /* istanbul ignore if */
        if (size > BUFFER.kMaxLength) {
          fs.unlink(path.join(tmp, 'ciphertext'), () => {
            return next(new Error(
              `File size exceeds max supported (${bytes(BUFFER.kMaxLength)})`
            ));
          });
        }

        object.save(() => {
          this.distribute(ciphertext, object, (err, object) => {
            if (err) {
              return next(err);
            }

            res.status(201).send(object.toObject());
          });
        });
      });
    });

    req.pipe(busboy);
  }

  /**
   * Takes the supplied file path and applies erasure codes, then attempts to
   * distribute the shards across the network
   * @param {string} filepath - Path to the file to distribute
   * @param {object} metadata
   * @param {ObjectPointer} object
   * @param {function} callback
   * @returns {EventEmitter}
   */
  distribute(filepath, object, callback) {
    const stat = fs.statSync(filepath);
    const rsparams = utils.getErasureParameters(stat.size);
    const rs = new ReedSolomon(rsparams.shards, rsparams.parity);

    const encodeErasure = (callback) => {
      fs.readFile(filepath, (err, file) => {
        /* istanbul ignore if */
        if (err) {
          return callback(err);
        }

        let parity = [];
        let { size } = rsparams;

        for (let i = 0; i < rsparams.parity; i++) {
          parity.push(Buffer.alloc(rsparams.size));
        }

        file = Buffer.concat([file, Buffer.concat(parity)]);
        rs.encode(file, 0, file.length, size, 0, size, (err) => {
          /* istanbul ignore if */
          if (err) {
            callback(err);
          } else {
            callback(null, file, rsparams, object);
          }
        });
      });
    }

    const prepareShards = (file, rsparams, object, callback) => {
      let shards = [];
      let position = 0;

      const prepareContracts = () => {
        async.eachSeries(shards, (shard, next) => {
          const audit = new AuditStream(constants.NUM_CHALLENGES);
          const readStream = fs.createReadStream(shard.path);
          const hash = crypto.createHash('sha256');
          const hasher = new stream.Transform({
            transform: (data, enc, cb) => {
              hash.update(data);
              cb(null, data);
            }
          });

          readStream.pipe(hasher).pipe(audit).on('finish', () => {
            const record = audit.getPrivateRecord();

            shard.audits = {};
            shard.audits.root = record.root.toString('hex')
            shard.audits.depth = record.depth;
            shard.audits.challenges = record.challenges;

            shard.proposal = new this.database.ShardContract({
              shardHash: utils.rmd160(hash.digest()).toString('hex'),
              shardSize: rsparams.size,
              auditLeaves: audit.getPublicRecord(),
              ownerParentKey: this.node.contact.xpub,
              ownerIndex: this.node.contact.index,
              ownerIdentity: this.node.identity.toString('hex'),
              accessPolicies: object.policies
            });
            shard.proposal.sign('owner', this.node.spartacus.privateKey);
            next();
          });
        }, () => {
          object.shards = shards;
          object.save(() => callback(null, shards, object));
        });
      }

      async.timesLimit(rsparams.shards + rsparams.parity, 1, (n, done) => {
        const pad = (n) => n >= 10 ? n.toString() : `0${n}`;
        const shardpath = path.join(path.dirname(filepath), `${pad(n)}.shard`);
        const bufferSlice = file.slice(position, position + rsparams.size);

        fs.writeFile(shardpath, bufferSlice, () => {
          position += rsparams.size;
          shards.push({ index: n, size: rsparams.size, path: shardpath });
          done();
        });
      }, () => {
        fs.unlink(filepath, () => prepareContracts());
      });
    };

    const uploadShards = (shards, object, callback) => {
      let completed = 0;

      async.eachLimit(shards, 3, (shard, next) => {
        async.retry({ times: 10 }, (done) => {
          this._pluckStorageProvider(shard.size, (err, target) => {
            if (err) {
              return done(err);
            }

            let proposal = shard.proposal;
            let rs = fs.createReadStream(shard.path);

            this.node.logger.info(`requesting upload to ${target[0]}`);
            this.notifyClients(
              'TRANSFER_UP_INFO',
              object.hash,
              `Requesting upload channel from ${target[1].hostname}`,
              { target, shard: proposal.shardHash }
            );
            this._createUploadChannel({
              stream: rs,
              target,
              proposal: proposal.toObject(),
              shard
            }, (err) => {
              if (err) {
                this.notifyClients(
                  'TRANSFER_UP_FAIL',
                  object.hash,
                  `Failed upload channel with ${target[1].hostname}`,
                  {
                    target,
                    shard: proposal.shardHash,
                    error: err.message
                  }
                );
                return this._markPeerAsFailed(target, () => done(err));
              }

              this.notifyClients(
                'TRANSFER_UP_PASS',
                object.hash,
                `Uploaded ${shard.hash} to ${target[1].hostname}`,
                {
                  shard: shard.hash,
                  total: shards.length,
                  complete: ++completed
                }
              );
              done();
            });
          });
        }, next);
      }, (err) => {
        object.shards = shards;

        if (err) {
          object.status = 'failed';
          this.node.logger.error(err.message);
          object.save(() => callback(err));
        } else {
          object.status = 'finished';
          this.node.logger.info(`successfully uploaded ${object.hash}`);
          this.node.logger.info(`removing stage ${path.dirname(filepath)}`);
          rimraf(path.dirname(filepath), (err) => {
            /* istanbul ignore if */
            if (err) {
              this.node.logger.error(err.message);
            }

            object.save(() => callback(null, object));
          });
        }
      });
    }

    const distributePointer = (object, callback) => {
      const { blob, hash } = object.toEncryptedBlob();
      const key = hash.toString('hex');
      const encoded = blob.toString('base64');

      this.node.iterativeStore(key, encoded, (err, stored) => {
        if (stored < 3) {
          this.node.logger.warn(
            `failed to fully distribute pointer (${stored} of 3)`
          );
        }

        callback(null, object);
      });
    };

    async.waterfall([
      (next) => encodeErasure(next),
      (file, rs, obj, next) => prepareShards(file, rs, obj, next),
      (shards, obj, next) => uploadShards(shards, obj, next)
    ], (err, object) => {
      if (err) {
        return callback(err);
      }

      distributePointer(object, () => {
        this.node.logger.info('finished pointer distribution');
      });
      callback(null, object);
    });
  }

  /**
   * Downloads the object from the network
   * @param {object} request
   * @param {object} response
   * @param {function} next
   */
  downloadObject(req, res, next) {
    this._downloadObject(req.params.id, (err, buffer, object, info) => {
      /* istanbul ignore if */
      if (err) {
        return next(err);
      }

      const { rsparams } = info;
      const decipher = utils.createDecipher(
        Buffer.from(object.ecpub, 'hex'),
        Buffer.from(object.ecprv, 'hex')
      );

      decipher.on('error', (err) => {
        this.node.logger.error(err.message);
        res.end();
      });

      res.writeHead(200, {
        'Content-Type': object.mimetype,
        'Content-Length': object.size,
        'Transfer-Encoding': ''
      });

      decipher.pipe(slice(0, object.size - rsparams.padding)).pipe(res);
      decipher.end(buffer);
    });
  }

  /**
   * @private
   * @param {string} id
   * @param {function} callback
   */
  _downloadObject(id, next) {
    let targets = 0;
    let failed = [];
    let buffer = null;
    let object = null;
    let completed = 0;

    function updateRecovery(shard, i) {
      let recovery = {
        shard,
        offset: shard.size * i,
        length: (shard.size * i) + shard.size
      };
      failed.push(recovery);
      buffer.fill(0, recovery.offset, recovery.length);
      targets |= (1 << i);
    }

    const downloadShard = (shard, token, i, callback) => {
      this.notifyClients(
        'TRANSFER_DOWN_INFO',
        object.hash,
        `Requesting download channel from ${shard.service[1].hostname}`,
        { shard: shard.hash }
      );

      let downloadStream = utils.createShardDownloader(
        shard.service,
        shard.hash,
        token,
        this.node.onion.createSecureAgent()
      );
      let tmpBuffer = Buffer.from([]);

      downloadStream.on('error', (err) => {
        this.notifyClients(
          'TRANSFER_DOWN_FAIL',
          object.hash,
          `Failed upload channel with ${shard.service[1].hostname}`,
          { shard: shard.hash, error: err.message }
        );
        this.node.logger.warn(
          `failed to download, reason: ${err.message}`
        );
        updateRecovery(shard, i);
        callback();
      });

      downloadStream.on('data', (data) => {
        tmpBuffer = Buffer.concat([tmpBuffer, data]);
      });

      downloadStream.on('end', () => {
        this.notifyClients(
          'TRANSFER_DOWN_PASS',
          object.hash,
          `Donwloaded ${shard.hash} from ${shard.service[1].hostname}`,
          {
            shard: shard.hash,
            total: object.shards.length,
            complete: ++completed
          }
        );
        buffer.fill(tmpBuffer, shard.size * i, (shard.size * i) + shard.size);
        callback();
      });
    };

    const assembleShards = (object, size, rs, callback) => {
      let done = (err) => callback(err, buffer);

      try {
        rs.decode(buffer, 0, size, object.shards[0].size, 0,
                  object.shards[0].size, targets, done);
      } catch (err) {
        /* istanbul ignore next */
        callback(err);
      }
    };

    this.database.ObjectPointer.findOne({ _id: id }, (err, result) => {
      object = result;

      /* istanbul ignore if */
      if (err || !object) {
        return next(err || new Error('Not found'));
      }

      /* istanbul ignore if */
      if (object.status !== 'finished') {
        return next(new Error(
          'Cannot fetch object that did not complete upload'
        ));
      }

      let size = object.shards.reduce(
        (a, b) => ({ size: a.size + b.size }),
        { size: 0 }
      ).size;
      let rsparams = utils.getErasureParameters(size);
      let rs = new ReedSolomon(rsparams.shards, rsparams.parity);

      /* istanbul ignore if */
      if (size > BUFFER.kMaxLength) {
        return next(new Error(
          `File size exceeds max supported (${bytes(BUFFER.kMaxLength)})`
        ));
      }

      buffer = Buffer.alloc(size);

      async.eachOfLimit(object.shards, 3, (shard, i, done) => {
        this.node.authorizeRetrieval(
          shard.service,
          [shard.hash],
          (err, result) => {
            if (err) {
              this.node.logger.warn(err.message);
              updateRecovery(shard, i);
              return done();
            }

            downloadShard(shard, result[0], i, done);
          }
        );
      }, () => {
        assembleShards(object, size, rs, err => {
          /* istanbul ignore if */
          if (err) {
            return next(err);
          }

          const decipher = utils.createDecipher(
            Buffer.from(object.ecpub, 'hex'),
            Buffer.from(object.ecprv, 'hex')
          );

          decipher.on('error', (err) => {
            this.node.logger.error(err.message);
          });

          decipher.pipe(slice(0, object.size - rsparams.padding)),
          decipher.end(buffer);

          next(null,
            buffer,
            object,
            { failed, rsparams }
          );
        });
      });
    });
  }

  /**
   * Ends contracts with farmers for the object parts and removes
   * reference to them
   * @param {object} request
   * @param {object} response
   * @param {function} next
   */
  destroyObject(req, res, next) {
    let id = req.params.id;

    this.database.ObjectPointer.findOne({ _id: id }, (err, object) => {
      /* istanbul ignore if */
      if (err) {
        return next(err);
      }

      async.each(object.shards, (shard, done) => {
        this.database.ShardContract.remove({
          shardHash: shard.hash
        }, (err) => {
          /* istanbul ignore if */
          if (err) {
            this.node.logger.error(
              `failed to remove shard contract ${shard.hash}`
            );
          }

          done();
        });
      }, () => {
        // NB: If we are deleting a pointer to a queued object,
        // NB: make sure we clean up
        let tmp = path.join(this.options.tempStagingDirectory, object.hash);

        if (fs.existsSync(tmp)) {
          try {
            rimraf.sync(tmp);
          } catch (err) {
            /* istanbul ignore next */
            this.node.logger.error(err.message);
          }
        }

        object.remove((err) => {
          /* istanbul ignore if */
          if (err) {
            return next(err);
          }

          res.status(201).send();
        })
      });
    });
  }

  /**
   * Returns the magnet link for the given object
   * @param {object} request
   * @param {object} response
   * @param {function} next
   */
  getObjectMagnet(req, res, next) {
    const { id } = req.params;

    this.database.ObjectPointer.findOne({ _id: id }, (err, object) => {
      /* istanbul ignore if */
      if (err || !object) {
        return next(err || new Error('Object not found'));
      }

      const { magnet } = object.toEncryptedBlob();

      res.status(200).json({ href: magnet });
    });
  }

  /**
   * Accepts a body containing a magnet link, resolves the pointer and creates
   * a local object pointer record, then returns it. Clients can follow with a
   * GET /:id to download the object
   * @param {object} request
   * @param {object} response
   * @param {function} next
   */
  resolveObject(req, res, next) {
    req.on('error', next).pipe(concat((body) => {
      let parsed, key;

      try {
        parsed = qs.parse(url.parse(body.toString()).query);
        key = Buffer.from(parsed.xt.substr(8), 'hex').toString('hex');
      } catch (err) {
        /* istanbul ignore next */
        return next(new Error('Failed to parse magnet link'));
      }

      this.node.iterativeFindValue(key, (err, result) => {
        /* istanbul ignore if */
        if (err || result.length >= 0) {
          return next(err || new Error('Failed to resolve magnet'));
        }

        let decipher, cleartext;

        try {
          decipher = crypto.createDecipher(
            'aes256',
            Buffer.from(parsed['x.pword'], 'hex')
          );
          cleartext = JSON.parse(Buffer.concat([
            decipher.update(Buffer.from(result.value, 'base64')),
            decipher.final()
          ]).toString('utf8'));
        } catch (err) {
          /* istanbul ignore next */
          return next(new Error('Failed to decrypt pointer'));
        }

        let object = new this.database.ObjectPointer(merge(cleartext, {
          ecprv: parsed['x.ecprv'],
          _isOwner: false
        }));

        object.save((err) => {
          /* istanbul ignore if */
          if (err) {
            return next(err);
          }

          res.status(200).json(object.toObject());
        });
      });
    }));
  }

  /**
   * Periodically call this to scan the object store for shards that need to
   * be audited
   * @param
   * @param {function} callback
   */
  audit(callback = () => null) {
    const opportunities = constants.SCORE_INTERVAL / constants.AUDIT_INTERVAL;
    const query = {
      _lastAuditTimestamp: { $lt: Date.now() - constants.SCORE_INTERVAL },
      _isOwner: true
    };

    this.node.logger.info('starting audit routine');
    this.database.ObjectPointer.find(query, (err, objects) => {
      /* istanbul ignore if */
      if (err) {
        return callback(err);
      }

      const total = Math.ceil(objects.length / opportunities);
      const candidates = [];

      while (candidates.length !== total) {
        candidates.push(knuthShuffle(objects).pop());
      }

      this.node.logger.info(`preparing ${candidates.length} objects for audit`);
      async.eachSeries(
        candidates,
        (obj, next) => this._auditObject(obj, next),
        (err) => {
          /* istanbul ignore if */
          if (err) {
            this.node.logger.warn(err.message);
            return callback(err);
          }

          this.emit('auditInternalFinished');
          callback();
        }
      );
    });
  }

  /**
   * @private
   */
  _createUploadChannel({ stream, target, proposal, shard }, done) {
    this.node.claimProviderCapacity(target, proposal, (err, data) => {
      if (err) {
        this.node.logger.warn(
          `failed to claim capacity, reason: ${err.message}`
        );
        return done(err);
      }

      this.node.logger.info(`capacity claimed from ${target[0]}`);

      let [completedContract, consignToken] = data;
      let uploadStream = utils.createShardUploader(
        target,
        completedContract.shardHash,
        consignToken,
        this.node.onion.createSecureAgent()
      );

      completedContract = new this.database.ShardContract(
        completedContract
      );

      uploadStream.on('error', done);
      uploadStream.on('response', (res) => {
        let body = '';
        res.on('data', (data) => body += data.toString());
        res.on('end', () => {
          /* istanbul ignore if */
          if (res.statusCode !== 200) {
            this.node.logger.warn(
              `failed to upload shard, reason: ${body}`
            );
            return done(new Error(body));
          }

          this.node.logger.debug(`shard uploaded to ${target[0]}`);
          delete shard.proposal;
          delete shard.path;
          shard.service = target;
          shard.hash = completedContract.shardHash;
          completedContract.save((err) => done(err));
        });
      });

      stream.on('data', (data) => uploadStream.write(data))
        .on('end', () => uploadStream.end())
        .on('error', (err) => {
          /* istanbul ignore next */
          uploadStream.removeAllListeners();
          /* istanbul ignore next */
          done(err);
        });
    });
  }

  /**
   * @private
   */
  _auditObject(object, callback) {
    this.node.logger.info(`auditing object ${object.hash}`);
    async.mapLimit(object.shards, 3, (shard, done) => {
      this.database.ShardContract.findOne({
        shardHash: shard.hash
      }, (err, contract) => {
        /* istanbul ignore if */
        if (err) {
          done(err);
        } else if (shard.audits.challenges.length === 0) {
          this.node.logger.info(`regenerating challenges for ${shard.hash}`);
          this._regenerateChallenges(shard, (err) => {
            object.save(() => done(err, [shard, contract]));
          });
        } else {
          done(null, [shard, contract])
        }
      });
    }, (err, results) => {
      /* istanbul ignore if */
      if (err) {
        return callback(err);
      }

      async.eachLimit(results, 3, ([shard, contract], done) => {
        let challenge = shard.audits.challenges.shift();
        let audits = [{ hash: shard.hash, challenge }];
        let contact = [
          shard.service[0],
          this.node.router.getContactByNodeId(
            shard.service[0]
          ) || shard.service[1]
        ];

        contract._lastAuditTimestamp = Date.now();

        this.node.auditRemoteShards(contact, audits, (err, proofs) => {
          const fail = (err, expected, actual) => {
            shard.decayed = true;

            const report = new this.database.AuditReport({
              reporter: this.node.identity.toString('hex'),
              provider: contract.providerIdentity,
              challenge, expected, actual
            });

            this.node.logger.warn(err.message);
            report.save(() => contract.save(() => done()));
          };

          /* istanbul ignore if */
          if (err) {
            return fail(err);
          }

          const pass = (report) => {
            report.save(() => contract.save(() => done()));
          };

          let { proof } = proofs.pop() || { proof: [] };
          let [actual, expected] = Proof.verify(
            proof,
            Buffer.from(shard.audits.root, 'hex'),
            shard.audits.depth
          );

          if (Buffer.compare(expected, actual) !== 0) {
            return fail(new Error('Audit response failed verification'),
                        expected.toString('hex'), actual.toString('hex'));
          }

          const report = new this.database.AuditReport({
            reporter: this.node.identity.toString('hex'),
            provider: contract.providerIdentity,
            challenge,
            expected: expected.toString('hex'),
            actual: actual.toString('hex')
          });

          if (shard.audits.challenges.length === 0) {
            this._regenerateChallenges(shard, () => pass(report));
          } else {
            pass(report);
          }
        });
      }, () => {
        object.save((err) => {
          /* istanbul ignore if */
          if (err) {
            return callback(err);
          }

          /* istanbul ignore else */
          if (object.percentDecayed >= 0.15) {
            let threshold = Math.ceil(constants.MAX_DECAY * 100).toFixed();
            let decay = Math.ceil(object.percentDecayed * 100).toFixed();
            this.node.logger.info(
              `object decay more than ${threshold}% (${decay}%), will rebuild`
            );
            this._rebuildObject(object, callback);
          } else {
            callback();
          }
        });
      });
    });
  }

  /**
   * @private
   */
  _rebuildObject(object, callback = () => null) {
    this.node.logger.info(`rebuilding object ${object.id}`);
    this._downloadObject(object.id, (err, buffer, object, info) => {
      /* istanbul ignore if */
      if (err) {
        this.node.logger.error(`failed to download object, ${err.message}`);
        return callback(err);
      }

      const { failed, rsparams } = info;

      async.eachLimit(failed, 3, (recovery, done) => {
        const { shard, offset, length } = recovery;
        const auditStream = new AuditStream(constants.NUM_CHALLENGES);
        const slice = buffer.slice(offset, length);

        auditStream.on('error', done).on('finish', () => {
          const record = auditStream.getPrivateRecord();

          shard.audits = {};
          shard.audits.challenges = record.challenges;
          shard.audits.depth = record.depth;
          shard.audits.root = record.root.toString('hex');

          const proposal = new this.database.ShardContract({
            shardHash: shard.hash,
            shardSize: rsparams.size,
            auditLeaves: auditStream.getPublicRecord(),
            ownerParentKey: this.node.contact.xpub,
            ownerIndex: this.node.contact.index,
            ownerIdentity: this.node.identity.toString('hex'),
            accessPolicies: object.policies
          });

          this._pluckStorageProvider(shard.size, (err, target) => {
            /* istanbul ignore if */
            if (err) {
              return done(err);
            }

            shard.service = target;
            this.database.ShardContract.remove({
              shardHash: shard.hash,
              ownerIdentity: {
                $not: { $eq: this.node.identity.toString('hex') }
              }
            }, () => {
              this._createUploadChannel({
                stream: utils.bufferAsReadableStream(slice),
                proposal: proposal.toObject(),
                target, shard
              }, (err) => {
                /* istanbul ignore if */
                if (err) {
                  this.node.logger.error(err.message)
                } else {
                  this.node.logger.info(`shard ${shard.hash} redistributed`);
                }

                done(err);
              });
            });
          });
        });

        auditStream.end(slice);
      }, () => object.save(callback));
    });
  }

  /**
   * @private
   * @param {number} size
   * @param {function} callback
   */
  _pluckStorageProvider(size, callback) {
    this.database.PeerProfile.find({
      'capacity.timestamp': {
        $gt: Date.now() - this.options.peerCapacityPoolTimeout
      },
      'capacity.available': { $gt: size },
      identity: { $ne: this.node.identity.toString('hex') },
      $or: [
        {
          _failed: {
            $lt: Date.now() - this.options.peerFailureBlacklistTimeout
          }
        },
        { _failed: { $exists: false } }
      ]
    }, (err, profiles) => {
      /* eslint max-statements: [2, 20] */
      if (err) {
        this.node.logger.error(err.message);
        this.node.logger.warn('failed to load capacity cache');
        profiles = [];
      }

      let target = undefined;
      let contact = undefined;

      knuthShuffle(profiles);

      for (let i = 0; i < profiles.length; i++) {
        contact = this.node.router.getContactByNodeId(
          profiles[i].identity
        );
        target = contact
               ? [profiles[i].identity, contact]
               : [profiles[i].identity, profiles[i].contact];

        /* istanbul ignore else */
        if (target !== undefined) {
          break;
        }
      }

      if (target === undefined) {
        this.node.logger.warn(
          'not enough capacity data collected to upload'
        );
        callback(new Error('Not enough capacity information'));
      } else {
        callback(null, target);
      }
    });
  }

  /**
   * @private
   */
  _regenerateChallenges(shard, callback = () => null) {
    const auditStream = new AuditStream(constants.NUM_CHALLENGES);

    this.node.authorizeRetrieval(shard.service, [shard.hash], (err, result) => {
      /* istanbul ignore if */
      if (err) {
        return callback(err);
      }

      const downloadStream = utils.createShardDownloader(
        shard.service,
        shard.hash,
        result[0],
        this.node.onion.createSecureAgent()
      );

      downloadStream.pipe(auditStream).on('finish', () => {
        const record = auditStream.getPrivateRecord();

        shard.audits = {};
        shard.audits.challenges = record.challenges;
        shard.audits.depth = record.depth;
        shard.audits.root = record.root.toString('hex');

        this.node.database.ShardContract.findOne({
          shardHash: shard.hash
        }, (err, contract) => {
          /* istanbul ignore if */
          if (err) {
            return callback(err);
          }

          contract.auditLeaves = auditStream.getPublicRecord();
          contract.sign('owner', this.node.spartacus.privateKey);
          contract.save((err) => {
            /* istanbul ignore if */
            if (err) {
              return callback(err);
            }

            this.node.requestContractRenewal(shard.service,
                                             contract.toObject(), callback);
          });
        });
      }).on('error', callback);
    });
  }

  /**
   * Set the date of _failed on the peer profile
   * @private
   */
  _markPeerAsFailed([identity], callback) {
    this.database.PeerProfile.update({ identity }, {
      $set: { _failed: Date.now() }
    }, callback);
  }

  /**
   * Takes all audit reports and reaps them while applying their results to
   * local peer profile reputation score, then publishes the compressed
   * payload to the bootstrap directory
   * @param {function} callback
   */
  scoreAndPublishAuditReports(callback = () => null) {
    const payload = [];
    const profiles = new Set();

    const cursor = this.database.AuditReport.find({}).cursor();
    const worker = (report, done) => {
      const { reporter, provider } = report;

      payload.push(report.toCompressedAuthenticated(
        this.node.spartacus.privateKey
      ));

      this.database.PeerProfile.count({
        identity: { $in: [reporter, provider] }
      }, (err, count) => {
        /* istanbul ignore if */
        if (count !== 2) {
          this.node.logger.warn(
            'skipping score application for unknown peer(s)'
          );
          return done();
        }

        profiles.add(reporter);
        profiles.add(provider);

        this._applyScore(report, () => done());
      });
    };
    const queue = async.queue(worker, 1);

    queue.drain = () => {
      this.node.reportAuditResults(payload, (err) => {
        /* istanbul ignore if */
        if (err) {
          this.node.logger.warn(err.message);
        }

        async.series([
          // NB: Keep track of reporting streaks
          (done) => {
            this.database.PeerProfile.update({
              identity: { $in: [...profiles] }
            }, {
              $inc: { '_reports.streak': 1 },
              $set: { '_reports.missed': 0 }
            }, done);
          },
          // NB: Keep track of missed reports
          (done) => {
            this.database.PeerProfile.update({
              identity: { $not: { $in: [...profiles] } }
            }, {
              $set: { '_reports.streak': 0 },
              $inc: { '_reports.missed': 1 }
            }, done);
          },
          // NB: Apply reward for 10+ streak
          (done) => {
            this.database.PeerProfile.update({
              '_reports.streak': { $gte: 10 }
            }, {
              $inc: { 'reputation.score': 6 }
            }, done);
          },
          // NB: Apply penalty for 2+ missed
          (done) => {
            this.database.PeerProfile.update({
              '_reports.missed': { $gt: 2 },
            }, {
              $inc: { 'reputation.score': -3 }
            }, done);
          },
          // NB: Rebalance any negative scores
          (done) => {
            this.database.PeerProfile.update({
              'reputation.score': { $lt: 0 }
            }, {
              $set: { 'reputation.score': 0 }
            }, done);
          },
          // NB: Clean up all consumed reports
          (done) => {
            this.database.AuditReport.remove({}, done);
          }
        ], callback);
      });
    };

    cursor.on('data', (report) => queue.push(report)).on('error', callback);
  }

  /**
   * @private
   */
  _applyScore(auditReport, callback) {
    async.series([
      // NB: Reporter loses 1 per report
      (done) => {
        this.database.PeerProfile.findOneAndUpdate({
          identity: auditReport.reporter
        }, {
          $inc: { 'reputation.score': -1 }
        }, done);
      },
      // NB: Reporter gains 1 per positive report
      (done) => {
        if (auditReport.expected === auditReport.actual) {
          this.database.PeerProfile.findOneAndUpdate({
            identity: auditReport.reporter
          }, {
            $inc: { 'reputation.score': 1 }
          }, done);
        } else {
          done();
        }
      },
      // NB: Reporter gains 1 if another peer reports the same outcome
      (done) => {
        this.database.AuditReport.findOne({
          provider: auditReport.provider,
          reporter: { $not: { $eq: auditReport.reporter } }
        }, (err, corroboratedReport) => {
          if (err || !corroboratedReport) {
            done();
          } else if (auditReport.outcome === corroboratedReport.outcome) {
            this.database.PeerProfile.findOneAndUpdate({
              identity: auditReport.reporter
            }, {
              $inc: { 'reputation.score': 1 }
            }, done);
          } else {
            done();
          }
        });
      },
      // NB: Reporter gains 1 if the provider reported on them too
      (done) => {
        this.database.AuditReport.findOne({
          reporter: auditReport.provider,
          provider: auditReport.reporter
        }, (err, mutualReport) => {
          if (mutualReport) {
            this.database.PeerProfile.findOneAndUpdate({
              identity: auditReport.reporter
            }, {
              $inc: { 'reputation.score': 1 }
            }, done);
          } else {
            done();
          }
        });
      }
    ], () => callback());
  }

  /**
   * @private
   */
  getReputationImpact(req, res, next) {
    this.getPeerReputationScore(req.params.id, (err, result) => {
      /* istanbul ignore if */
      if (err) {
        return next(err);
      }

      res.status(200).send(result);
    });
  }

  /**
   * Calculates the percentile and relative usage allowance of the given identity
   * @param {string} identity - 160 bit node identity key
   * @param {Directory~getPeerReputationScoreCallback} callback
   */
  getPeerReputationScore(identity, callback) {
    let target, highest, capacity, percentile, allowance, score, peers = {};

    async.series([
      (next) => {
        this._getPeerProfileById(identity, (err, profile) => {
          target = profile;
          score = target ? target.reputation.score : 0;

          /* istanbul ignore if */
          if (!profile) {
            err = new Error('Profile not found');
            err.code = 404;
          }

          next(err);
        });
      },
      (next) => {
        this._getHighestScoringPeer((err, profile) => {
          highest = profile;
          next(err);
        });
      },
      (next) => {
        this._getTotalKnownNetworkCapacity((err, result) => {
          capacity = result;
          next(err);
        })
      },
      (next) => {
        async.parallel([
          (done) => this.database.PeerProfile.count({
            'reputation.score': { $gte: target.reputation.score }
          }, (err, count) => {
            peers.upper = count;
            done(err);
          }),
          (done) => this.database.PeerProfile.count({
            'reputation.score': { $lte: target.reputation.score }
          }, (err, count) => {
            peers.lower = count;
            done(err);
          })
        ], next);
      },
      (next) => {
        percentile = score / (highest.reputation.score || 1);
        percentile = parseFloat(percentile.toFixed(2));

        if (percentile < 0.2) {
          allowance = Math.floor((0.05 * capacity.available) / peers.lower);
        } else if (percentile > 0.2 && percentile < 0.5) {
          allowance = Math.floor((0.20 * capacity.available) / peers.lower);
        } else {
          allowance = Math.floor((0.75 * capacity.available) / peers.upper);
        }

        next();
      }
    ], (err) => callback(err, {
      identity, percentile, allowance, score, capacity
    }));
  }
  /**
   * @callback Directory~getPeerReputationScoreCallback
   * @param {object|null} error
   * @param {object} result
   * @param {number} result.score - Numberical repuation score
   * @param {number} result.percentile - Percent of scores identity exceeds
   * @param {number} result.allowance - Bytes identity is allowed to claim
   */

  /**
   * @private
   */
  _getTotalKnownNetworkCapacity(callback) {
    let allocated, available;

    this.database.PeerProfile
      .aggregate([
        {
          $match: {
            'capacity.timestamp': { $gte: new Date(Date.now() - ms('24HR')) }
          }
        },
        {
          $group: {
            _id: null,
            available: { $sum: '$capacity.available' },
            allocated: { $sum: '$capacity.allocated' }
          }
        }
      ])
      .cursor({})
      .exec()
      .on('data', data => {
        allocated = data.allocated;
        available = data.available;
      })
      .on('error', callback)
      .on('end', () => callback(null, { allocated, available }));
  }

  /**
   * Get the peer with the highest reputation score
   * @private
   */
  _getHighestScoringPeer(callback) {
    this.database.PeerProfile
      .find({})
      .sort({ 'reputation.score': -1 })
      .exec((err, results) => {
        /* istanbul ignore if */
        if (err) {
          return callback(err);
        }

        /* istanbul ignore if */
        if (!results.length) {
          return callback(new Error('Failed to load peer profile'));
        }

        callback(null, results[0]);
      });
  }

  /**
   * @private
   */
  _getPeerProfileById(identity, callback) {
    this.database.PeerProfile.findOne({ identity }, callback);
  }

  /**
   * @private
   */
  listProfiles(req, res, next) {
    let now = Date.now();

    this.database.PeerProfile.find({
      $or: [
        { 'capacity.timestamp': { $gt: now - ms('24HR') } },
        { updated: { $gt: now - ms('24HR') } }
      ]
    }, [], {
      sort: { 'capacity.timestamp': -1 }
    }, (err, results) => {
      /* istanbul ignore if */
      if (err) {
        return next(err);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(results.map((r) => r.toObject())));
    });
  }

  /**
   * @private
   */
  getProfile(req, res, next) {
    this._getPeerProfileById(req.params.identity, (err, profile) => {
      /* istanbul ignore if */
      if (err) {
        return next(err);
      }

      if (!profile) {
        res.writeHead(404);
        res.end('Profile not known');
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(profile.toObject()));
      }
    });
  }

}

module.exports = Bridge;
