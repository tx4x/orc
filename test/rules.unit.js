'use strict';

const { expect } = require('chai');
const sinon = require('sinon');
const crypto = require('crypto');
const { randomBytes } = crypto;
const { utils: keyutils } = require('kad-spartacus');
const { Readable } = require('stream');
const utils = require('../lib/utils');
const AuditStream = require('../lib/audit');
const ProofStream = require('../lib/proof');
const Rules = require('../lib/rules');
const getDatabase = require('./fixtures/database');


describe('@class Rules', function() {

  let database = null;

  function createValidContract(hash) {
    const renterHdKey = keyutils.toHDKeyFromSeed().deriveChild(1);
    const farmerHdKey = keyutils.toHDKeyFromSeed().deriveChild(1);
    const contract = new database.ShardContract({
      ownerIdentity: keyutils.toPublicKeyHash(renterHdKey.publicKey)
                       .toString('hex'),
      providerIdentity: keyutils.toPublicKeyHash(farmerHdKey.publicKey)
                          .toString('hex'),
      ownerParentKey: renterHdKey.publicExtendedKey,
      providerParentKey: farmerHdKey.publicExtendedKey,
      ownerIndex: 1,
      providerIndex: 1,
      shardHash: hash ||
        crypto.createHash('rmd160').update('test').digest('hex'),
      shardSize: 4
    });
    contract.sign('owner', renterHdKey.privateKey);
    contract.sign('provider', farmerHdKey.privateKey);
    contract._farmerPrivateKey = farmerHdKey.privateKey;
    contract._renterPrivateKey = renterHdKey.privateKey;
    return contract;
  }

  before((done) => {
    getDatabase((err, db) => {
      database = db;
      done();
    });
  });

  describe('@method audit', function() {

    let auditStream = null;
    let dataShard = Buffer.from('this is a test shard');

    before(function(done) {
      auditStream = new AuditStream(2);
      auditStream.on('finish', done).end(dataShard);
    });

    it('should callback error if invalid audit batch', function(done) {
      const rules = new Rules({ database });
      const request = {
        params: {},
        contact: [
          'identity',
          { xpub: 'xpubkey' }
        ]
      };
      const response = {};
      rules.audit(request, response, (err) => {
        expect(err.message).to.equal('Invalid audit batch supplied');
        done();
      });
    });

    it('should callback error if invalid challenge', function(done) {
      const rules = new Rules({
        database: {
          ShardContract: {
            findOne: sinon.stub().callsArgWith(1, null, {
              shardHash: 'datahash',
              checkAccessPolicy: sinon.stub().returns(['AUDIT'])
            })
          }
        }
      });
      const request = {
        params: [{ hash: 'datahash' }],
        contact: [
          'identity',
          { xpub: 'xpubkey' }
        ]
      };
      const response = {};
      rules.audit(request, response, (err) => {
        expect(err.message).to.equal('Invalid challenge supplied');
        done();
      });
    });

    it('should return null if cannot load contract', function(done) {
      const rules = new Rules({
        database: {
          ShardContract: {
            findOne: sinon.stub().callsArgWith(1, new Error('Not found'))
          }
        }
      });
      const request = {
        params: [
          { hash: 'datahash', challenge: 'challengerequest' }
        ],
        contact: [
          'identity',
          { xpub: 'xpubkey' }
        ]
      };
      const response = {
        send: (params) => {
          expect(params[0].hash).to.equal('datahash');
          expect(params[0].proof).to.have.lengthOf(0);
          done();
        }
      };
      rules.audit(request, response, done);
    });

    it('should return null if cannot load shard', function(done) {
      const rules = new Rules({
        database: {
          ShardContract: {
            findOne: sinon.stub().callsArgWith(1, null, {
              shardHash: 'datahash',
              auditLeaves: [],
              checkAccessPolicy: sinon.stub().returns(['AUDIT'])
            })
          }
        },
        shards: {
          createReadStream: sinon.stub().callsArgWith(
            1,
            new Error('Not found')
          )
        }
      });
      const request = {
        params: [
          { hash: 'datahash', challenge: 'challengerequest' }
        ],
        contact: [
          'identity',
          { xpub: 'xpubkey' }
        ]
      };
      const response = {
        send: (params) => {
          expect(params[0].hash).to.equal('datahash');
          expect(params[0].proof).to.have.lengthOf(0);
          done();
        }
      };
      rules.audit(request, response, done);
    });

    it('should return [] if proof fails', function(done) {
      const shardParts = [dataShard];
      const readStream = new Readable({
        read: function() {
          if (shardParts.length) {
            this.push(shardParts.shift());
          } else {
            this.push(null);
          }
        }
      });
      const rules = new Rules({
        database: {
          ShardContract: {
            findOne: sinon.stub().callsArgWith(1, null, {
              shardHash: 'datahash',
              auditLeaves: auditStream.getPublicRecord(),
              checkAccessPolicy: sinon.stub().returns(['AUDIT'])
            })
          }
        },
        shards: {
          createReadStream: sinon.stub().callsArgWith(1, null, readStream)
        }
      });
      const request = {
        params: [{ hash: 'datahash', challenge: '00000000' }],
        contact: [
          'identity',
          { xpub: 'xpubkey' }
        ]
      };
      const response = {
        send: (params) => {
          expect(params[0].proof).to.have.lengthOf(0);
          done();
        }
      };
      rules.audit(request, response);
    });

    it('should callback error if no access', function(done) {
      const shardParts = [dataShard];
      const readStream = new Readable({
        read: function() {
          if (shardParts.length) {
            this.push(shardParts.shift());
          } else {
            this.push(null);
          }
        }
      });
      const rules = new Rules({
        database: {
          ShardContract: {
            findOne: sinon.stub().callsArgWith(1, null, {
              shardHash: 'datahash',
              auditLeaves: auditStream.getPublicRecord(),
              checkAccessPolicy: sinon.stub().returns([])
            })
          }
        },
        shards: {
          createReadStream: sinon.stub().callsArgWith(1, null, readStream)
        }
      });
      const request = {
        params: [{ hash: 'datahash', challenge: '00000000' }],
        contact: [
          'identity',
          { xpub: 'xpubkey' }
        ]
      };
      const response = {};
      rules.audit(request, response, (err) => {
        expect(err.message).to.equal('Not authorized');
        done();
      });
    });

    it('should return { hash, proof } if successful', function(done) {
      const shardParts = [dataShard];
      const readStream = new Readable({
        read: function() {
          if (shardParts.length) {
            this.push(shardParts.shift());
          } else {
            this.push(null);
          }
        }
      });
      const saveContract = sinon.stub().callsArg(0);
      const rules = new Rules({
        database: {
          ShardContract: {
            findOne: sinon.stub().callsArgWith(1, null, {
              shardHash: 'datahash',
              auditLeaves: auditStream.getPublicRecord(),
              checkAccessPolicy: sinon.stub().returns(['AUDIT']),
              save: saveContract
            })
          }
        },
        shards: {
          createReadStream: sinon.stub().callsArgWith(1, null, readStream)
        }
      });
      const request = {
        params: [
          {
            hash: 'datahash',
            challenge: auditStream.getPrivateRecord().challenges[0]
          }
        ],
        contact: [
          'identity',
          { xpub: 'xpubkey' }
        ]
      };
      const response = {
        send: (params) => {
          let { proof } = params[0];
          let { root, depth } = auditStream.getPrivateRecord();
          let [expected, actual] = ProofStream.verify(proof, root, depth);
          expect(Buffer.compare(expected, actual)).to.equal(0);
          expect(saveContract.called).to.equal(true);
          done();
        }
      };
      rules.audit(request, response);
    });

  });

  describe('@method consign', function() {

    it('should callback error if cannot load contract', function(done) {
      const rules = new Rules({ database });
      const request = {
        params: ['datahash'],
        contact: [
          'identity',
          { xpub: 'xpubkey' }
        ]
      };
      const response = {};
      rules.consign(request, response, (err) => {
        expect(err.message).to.equal('Contract not found');
        done();
      })
    });

    it('should create a token and respond with it', function(done) {
      const accept = sinon.stub();
      const contract = createValidContract();
      contract.checkAccessPolicy = sinon.stub().returns([]);
      const rules = new Rules({
        database: {
          ShardContract: {
            findOne: sinon.stub().callsArgWith(1, null, contract)
          }
        },
        server: {
          accept: accept
        }
      });
      const request = {
        params: ['datahash'],
        contact: [
          contract.ownerIdentity,
          { xpub: contract.ownerParentKey }
        ]
      };
      const response = {};
      rules.consign(request, response, (err) => {
        expect(err.message).to.equal('Not authorized');
        done();
      });
    });

    it('should create a token and respond with it', function(done) {
      const accept = sinon.stub();
      const contract = createValidContract();
      const rules = new Rules({
        database: {
          ShardContract: {
            findOne: sinon.stub().callsArgWith(1, null, contract)
          }
        },
        server: {
          accept: accept
        }
      });
      const request = {
        params: ['datahash'],
        contact: [
          contract.ownerIdentity,
          { xpub: contract.ownerParentKey }
        ]
      };
      const response = {
        send: (params) => {
          expect(typeof params[0]).to.equal('string');
          expect(accept.calledWithMatch(params[0])).to.equal(true);
          done();
        }
      };
      rules.consign(request, response, done);
    });

  });

  describe('@method retrieve', function() {

    it('should callback error if contract cannot load', function(done) {
      const rules = new Rules({ database });
      const request = {
        params: ['datahash'],
        contact: [
          'identity',
          { xpub: 'xpubkey' }
        ]
      };
      const response = {};
      rules.retrieve(request, response, (err) => {
        expect(err.message).to.equal('Contract not found');
        done();
      });
    });

    it('should callback error if shard data not found', function(done) {
      const rules = new Rules({
        database: {
          ShardContract: {
            findOne: sinon.stub().callsArgWith(1, null, createValidContract())
          }
        },
        shards: {
          exists: sinon.stub().callsArgWith(1, null, false)
        }
      });
      const request = {
        params: ['datahash'],
        contact: [
          'identity',
          { xpub: 'xpubkey' }
        ]
      };
      const response = {};
      rules.retrieve(request, response, (err) => {
        expect(err.message).to.equal('Shard not found');
        done();
      });
    });

    it('should create token and respond with it', function(done) {
      const accept = sinon.stub();
      const rules = new Rules({
        database: {
          ShardContract: {
            findOne: sinon.stub().callsArgWith(1, null, createValidContract())
          }
        },
        shards: {
          exists: sinon.stub().callsArgWith(1, null, true)
        },
        server: {
          accept: accept
        }
      });
      const request = {
        params: ['datahash'],
        contact: [
          'identity',
          { xpub: 'xpubkey' }
        ]
      };
      const response = {
        send: (params) => {
          expect(typeof params[0]).to.equal('string');
          expect(accept.calledWithMatch(params[0])).to.equal(true);
          done();
        }
      };
      rules.retrieve(request, response, done);
    });

  });

  describe('@method renew', function() {

    it('should callback error if contract invalid', function(done) {
      const rules = new Rules({ database });
      const request = {
        params: [{}],
        contact: [
          'identity',
          { xpub: 'xpubkey' }
        ]
      };
      const response = {};
      rules.renew(request, response, (err) => {
        expect(err.message).to.equal('Descriptor is invalid or incomplete');
        done();
      });
    });

    it('should callback error if cannot load contract', function(done) {
      const rules = new Rules({ database });
      const request = {
        params: [createValidContract().toObject()],
        contact: [
          'identity',
          { xpub: 'xpubkey' }
        ]
      };
      const response = {};
      rules.renew(request, response, (err) => {
        expect(err.message).to.equal('Contract not found');
        done();
      });
    });

    it('should callback error if restricted property', function(done) {
      const c1 = createValidContract();
      const c2 = createValidContract();
      const rules = new Rules({ database });
      const request = {
        params: [c1.toObject()],
        contact: [
          'identity',
          { xpub: 'xpubkey' }
        ]
      };
      const response = {};
      c2.save(err => {
        if (err) {
          return done(err);
        }
        rules.renew(request, response, (err) => {
          expect(err.message).to.equal(
            'Rejecting renewal of providerSignature'
          );
          done();
        });
      });
    });

    it('should callback error if cannot update local record', function(done) {
      const c1 = createValidContract(utils.rmd160('newtest').toString('hex'));
      const c2 = new database.ShardContract(c1.toObject());
      const rules = new Rules({
        database,
        spartacus: {
          privateKey: randomBytes(32)
        }
      });
      const request = {
        params: [c1.toObject()],
        contact: [
          'identity',
          { xpub: 'xpubkey' }
        ]
      };
      const response = {};
      c2.save(err => {
        if (err) {
          return done(err);
        }
        const save = sinon.stub(database.ShardContract.prototype, 'save')
                       .callsArgWith(0, new Error('Failed to write'));
        rules.renew(request, response, (err) => {
          save.restore();
          expect(err.message).to.equal('Failed to write');
          done();
        });
      });
    });

    it('should sign and echo back the renewal', function(done) {
      const c1 = createValidContract(utils.rmd160('valid').toString('hex'));
      const c2 = new database.ShardContract(c1.toObject());
      c2.auditLeaves = [randomBytes(32).toString('hex')];
      c2.sign('owner', randomBytes(32));
      const rules = new Rules({
        database,
        spartacus: {
          privateKey: randomBytes(32)
        }
      });
      const request = {
        params: [c1.toObject()],
        contact: [
          'identity',
          { xpub: 'xpubkey' }
        ]
      };
      const response = {
        send: (params) => {
          expect(params[0].auditLeaves).to.have.lengthOf(0);
          done();
        }
      };
      c2.save(err => {
        if (err) {
          return done(err);
        }
        rules.renew(request, response, done);
      });
    });

  });

  describe('@method claim', function() {

    it('should callback error if contract is invalid', function(done) {
      const contract = createValidContract();
      contract.shardHash = null;
      const rules = new Rules({
        identity: randomBytes(20),
        contact: {
          xpub: 'xpub',
          index: 0
        },
        spartacus: {
          privateKey: randomBytes(32)
        },
        database,
        shards: {
          size: sinon.stub().callsArgWith(0, null, { available: 1000 })
        }
      });
      const request = {
        params: [contract.toObject()],
        contact: [
          'identity',
          { xpub: 'xpubkey' }
        ]
      };
      const response = {};
      rules.claim(request, response, (err) => {
        expect(err.message).to.equal('Invalid shard descriptor');
        done();
      });
    });

    it('should callback error if no space', function(done) {
      const contract = createValidContract();
      const rules = new Rules({
        identity: randomBytes(20),
        contact: {
          xpub: contract.providerParentKey,
          index: contract.providerIndex
        },
        spartacus: {
          privateKey: contract._farmerPrivateKey
        },
        database,
        shards: {
          size: sinon.stub().callsArgWith(0, null, { available: 0 })
        }
      });
      const request = {
        params: [contract.toObject()],
        contact: [
          'identity',
          { xpub: 'xpubkey' }
        ]
      };
      const response = {};
      rules.claim(request, response, (err) => {
        expect(err.message).to.equal('Not enough capacity available');
        done();
      });
    });

    it('should callback error if cannot save', function(done) {
      const save = sinon.stub(database.ShardContract.prototype, 'save')
                     .callsArgWith(0, new Error('Failed to save'));
      const contract = createValidContract();
      const rules = new Rules({
        identity: randomBytes(20),
        contact: {
          xpub: contract.providerParentKey,
          index: contract.providerIndex
        },
        spartacus: {
          privateKey: contract._farmerPrivateKey
        },
        database,
        shards: {
          size: sinon.stub().callsArgWith(0, null, { available: 1000 })
        }
      });
      const request = {
        params: [contract.toObject()],
        contact: [
          contract.ownerIdentity,
          { xpub: contract.ownerParentKey }
        ]
      };
      const response = {};
      rules.claim(request, response, (err) => {
        save.restore();
        expect(err.message).to.equal('Failed to save');
        done();
      });
    });

    it('should respond with descriptor and token', function(done) {
      const contract = createValidContract();
      const accept = sinon.stub();
      const rules = new Rules({
        identity: randomBytes(20),
        contact: {
          xpub: contract.providerParentKey,
          index: contract.providerIndex
        },
        spartacus: {
          privateKey: contract._farmerPrivateKey
        },
        database,
        server: {
          accept: accept
        },
        shards: {
          size: sinon.stub().callsArgWith(0, null, { available: 1000 })
        }
      });
      const request = {
        params: [contract.toObject()],
        contact: [
          'identity',
          { xpub: 'xpubkey' }
        ]
      };
      const response = {
        send: (params) => {
          const c = new database.ShardContract(params[0]);
          expect(c.validateSync()).to.equal(undefined);
          expect(accept.calledWithMatch(params[1], contract.shardHash,
                                        request.contact));
          done();
        }
      };
      rules.claim(request, response, done);
    });

    it('should fail if invalid contract', function(done) {
      const contract = createValidContract();
      const accept = sinon.stub();
      const rules = new Rules({
        identity: randomBytes(20),
        contact: {
          xpub: contract.providerParentKey,
          index: -1
        },
        spartacus: {
          privateKey: contract._farmerPrivateKey
        },
        database,
        server: {
          accept: accept
        },
        shards: {
          size: sinon.stub().callsFake(function(callback) {
            callback(null, { available: 1000 });
          })
        }
      });
      const request = {
        params: [contract.toObject()],
        contact: [
          'identity',
          { xpub: 'xpubkey' }
        ]
      };
      const response = {
        send: () => done('Contract incorrectly passed validation')
      };
      rules.claim(request, response, (err) => {
        expect(err.message).to.equal('Invalid shard descriptor');
        done();
      });
    });

  });

});
