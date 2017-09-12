'use strict';

const constants = require('./constants');
const { Readable: ReadableStream } = require('stream');
const { EventEmitter } = require('events');
const BusBoy = require('busboy');
const ReedSolomon = require('@ronomon/reed-solomon');
const https = require('https');
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
const querystring = require('querystring');
const cors = require('cors');
const url = require('url');
const { utils: keyutils } = require('kad-spartacus');
const concat = require('concat-stream');
const qs = require('querystring');


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
 * If auth is enabled, then the websocket control bridge expects:
 * ?auth={base64(user:pass)} as the query string
 */
class Bridge extends EventEmitter {

  static get DEFAULTS() {
    return {
      auth: {
        user: null,
        pass: null
      },
      stage: path.join(
        tmpdir(),
        `staging.${crypto.randomBytes(16).toString('hex')}`
      ),
      enableSSL: false,
      serviceKeyPath: null,
      certificatePath: null,
      authorityChains: [],
      control: null
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
    this.control = this.options.control;
    this.wss = new ws.Server({
      server: this.server,
      verifyClient: (info, cb) => this._verifyClient(info, cb)
    });

    /* istanbul ignore else */
    if (!fs.existsSync(this.options.stage)) {
      mkdirp.sync(this.options.stage);
    }

    this.server.setTimeout(0);
    this._bindRoutes();
    setInterval(() => this.audit(), constants.AUDIT_INTERVAL);
  }

  /**
   * @private
   */
  _createServer(handler) {
    let server = null;

    /* istanbul ignore if */
    if (this.options.enableSSL) {
      server = https.createServer({
        key: fs.readFileSync(this.options.serviceKeyPath),
        cert: fs.readFileSync(this.options.certificatePath),
        ca: this.options.authorityChains
          ? this.options.authorityChains.map(fs.readFileSync)
          : []
      }, handler);
    } else {
      server = http.createServer(handler);
    }

    return server;
  }

  /**
   * @private
   */
  _verifyClient(info, callback) {
    const { user, pass } = this.options.auth;
    const { query } = url.parse(info.req.url);

    let creds = querystring.parse(query).auth;

    if (user && pass) {
      if (!creds) {
        return callback(false, 401, 'No credentials supplied');
      }

      creds = Buffer.from(creds, 'base64').toString('utf8').split(':');

      if (!(creds[0] === user && creds[1] === pass)) {
        return callback(false, 401, 'Invalid credentials');
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
    this.wss.on('connection', (sock) => {
      let client = new stream.Duplex({
        read: () => null,
        write: (data, enc, cb) => sock.send(data, cb)
      });
      this.control.client(client);
      sock.on('message', (data) => client.push(data));
      sock.on('error', (err) => client.emit('error', err));
      sock.on('close', () => client.emit('close'));
    });
  }

  /**
   * Creates request router and handler stack
   * @private
   * @returns {function}
   */
  _bindRoutes() {
    this.api.use(cors())
    this.api.use(this.authenticate.bind(this));
    this.api.get('/', this.list.bind(this));
    this.api.get('/:id', this.download.bind(this));
    this.api.get('/:id/magnet', this.magnet.bind(this));
    this.api.post('/', this.upload.bind(this));
    this.api.put('/', this.resolve.bind(this));
    this.api.delete('/:id', this.destroy.bind(this));
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
  list(req, res) {
    this.database.ObjectPointer.find({}, (err, pointers) => {
      /* istanbul ignore if */
      if (err) {
        res.status(500).send(err.message);
      } else {
        res.status(200).send(pointers.map((o) => o.toObject()));
      }
    });
  }

  /**
   * Queues the object for upload to the network
   * @param {object} request
   * @param {object} response
   * @param {function} next
   */
  upload(req, res, next) {
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
      const tmp = path.join(this.options.stage, id);

      mkdirp.sync(tmp);

      let size = 0;

      const hash = crypto.createHash('sha256');
      const hasher = new stream.Transform({
        transform: (data, enc, cb) => {
          size += data.length;
          hash.update(data);
          cb(null, data);
        }
      });

      const {publicKey: ecpub, privateKey: ecprv} = keyutils.toHDKeyFromSeed();
      const writer = fs.createWriteStream(path.join(tmp, 'ciphertext'));
      const cipher = utils.createCipher(ecpub, ecprv);

      objects.push({ name, encoding, mimetype: mime });
      file.pipe(hasher).pipe(cipher).pipe(writer).on('finish', () => {
        const digest = hash.digest('hex');
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
            shard.audits = audit.getPrivateRecord();
            shard.audits.root = shard.audits.root.toString('hex')
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
      async.eachLimit(shards, 3, (shard, next) => {
        async.retry({ times: 5 }, (done) => {
          this._pluckStorageProvider(shard.size, (err, target) => {
            if (err) {
              return done(err);
            }

            let proposal = shard.proposal;
            let rs = fs.createReadStream(shard.path);

            this.node.logger.info(`uploading shard to ${target[0]}`);
            this._createUploadChannel({
              stream: rs,
              target, proposal, shard
            }, done);
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
          this.node.logger.info(`successfully uploaded ${object._key}`);
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
      const encoded = blob.toString('base64');

      this.node.iterativeStore(hash, encoded, (err, stored) => {
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
      (shards, obj, next) => uploadShards(shards, obj, next),
      (object, next) => distributePointer(object, next)
    ], callback);
  }

  /**
   * Downloads the object from the network
   * @param {object} request
   * @param {object} response
   * @param {function} next
   */
  download(req, res, next) {
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
      let downloadStream = utils.createShardDownloader(
        shard.service,
        shard.hash,
        token,
        this.node.onion.createSecureAgent()
      );
      let tmpBuffer = Buffer.from([]);

      downloadStream.on('error', (err) => {
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

    this.database.ObjectPointer.findOne({ _id: id }, (err, object) => {
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
  destroy(req, res, next) {
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
  magnet(req, res, next) {
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
  resolve(req, res, next) {
    req.on('error', next).pipe(concat((body) => {
      let parsed;

      try {
        parsed = qs.parse(url.parse(body.toString()).query);
      } catch (err) {
        /* istanbul ignore next */
        return next(new Error('Failed to parse magnet link'));
      }

      this.node.iterativeFindValue(
        Buffer.from(parsed.xt.substr(8), 'hex'),
        (err, result) => {
          /* istanbul ignore if */
          if (err || result.length === 0) {
            return next(err || new Error('Failed to resolve magnet'));
          }

          let [item] = result;
          let decipher = crypto.createDecipher(
            'aes256',
            Buffer.from(parsed['x.pword'], 'hex')
          );
          let cleartext = Buffer.concat([
            decipher.update(item.value, 'base64'),
            decipher.final()
          ]).toString('utf8');
          let object = new this.database.ObjectPointer(merge(
            JSON.parse(cleartext),
            { ecprv: parsed['x.ecprv'], _isOwner: false }
          ));

          object.save((err) => {
            /* istanbul ignore if */
            if (err) {
              return next(err);
            }

            res.status(200).json(object.toObject());
          });
        }
      )
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
    this.node.claimFarmerCapacity(target, proposal, (err, data) => {
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
    async.mapLimit(object.shards, 3, (shard, done) => {
      this.database.ShardContract.findOne({
        shardHash: shard.hash
      }, (err, contract) => done(err, [shard, contract]));
    }, (err, results) => {
      /* istanbul ignore if */
      if (err) {
        return callback(err);
      }

      async.eachLimit(results, 3, ([shard, contract], done) => {
        let challenge = shard.audits.challenges.shift();
        let audits = [{ hash: shard.hash, challenge }];
        let contact = this.node.router.getContactByNodeId(
          shard.service[0]
        ) || shard.service;

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
          let [expected, actual] = Proof.verify(
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
            pass();
          }
        });
      }, () => {
        object.save((err) => {
          /* istanbul ignore if */
          if (err) {
            return callback(err);
          }

          /* istanbul ignore else */
          if (object.percentDecayed >= 0.25) {
            this.node.logger.info('object decay more than 25%, will rebuild');
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
    this._downloadObject(object.id, (err, buffer, object, info) => {
      /* istanbul ignore if */
      if (err) {
        return callback(err);
      }

      const rs = new ReadableStream({
        read: function() {
          if (this.bufferDrained) {
            this.push(null);
          } else {
            this.bufferDrained = true;
            this.push(buffer);
          }
        }
      });
      const { failed, rsparams } = info;

      async.eachLimit(failed, 3, (recovery, done) => {
        const { shard, offset, length } = recovery;
        const auditStream = new AuditStream(constants.NUM_CHALLENGES);
        const slice = buffer.slice(offset, length);

        auditStream.on('error', done).on('finish', () => {
          shard.audits = auditStream.getPrivateRecord();
          shard.audits.root = shard.audits.root.toString('hex');

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

            this.database.ShardContract.remove(
              {
                shardHash: shard.hash,
                ownerIdentity: {
                  $not: { $eq: this.node.identity.toString('hex') }
                }
              },
              () => this._createUploadChannel({
                stream: rs,
                proposal: proposal.toObject(),
                target, shard
              }, done)
            );
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
      'capacity.timestamp': { $gt: Date.now() - ms('24HR') },
      'capacity.available': { $gt: size }
    }, (err, profiles) => {
      /* eslint max-statements: [2, 20] */
      if (err) {
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
        shard.audits = auditStream.getPrivateRecord();
        shard.audits.root = shard.audits.root.toString('hex')

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

}

module.exports = Bridge;
