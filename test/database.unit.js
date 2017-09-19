'use strict';

const { expect } = require('chai');
const getDatabase = require('./fixtures/database');
const { KadStorageAdapter } = require('../lib/database');
const { utils: keyutils } = require('kad-spartacus');
const crypto = require('crypto');


describe('@class Database', function() {

  let database = null;

  before((done) => {
    getDatabase((err, db) => {
      database = db;
      done();
    });
  });

  it('should bubble errors from connection', function(done) {
    database.once('error', (err) => {
      expect(err.message).to.equal('Disconnected');
      done();
    });
    setImmediate(() => {
      database.connection.emit('error', new Error('Disconnected'))
    });
  });

  describe('@class PeerProfile', function() {

    it('should validate, save, and toObject the profile', function(done) {
      const key = keyutils.toHDKeyFromSeed();
      const profile = new database.PeerProfile({
        identity: keyutils.toPublicKeyHash(key.publicKey).toString('hex'),
        contact: {
          hostname: 'test.onion',
          port: 443,
          protocol: 'https:',
          xpub: key.publicExtendedKey,
          index: 1,
          agent: 'orc-test/linux'
        },
        capacity: {
          allocated: 1000,
          available: 1000,
          timestamp: Date.now()
        },
        reputation: {
          score: 0
        }
      });
      const object = profile.toObject();
      expect(object._id).to.equal(undefined);
      expect(object.__v).to.equal(undefined);
      expect(profile.toString()).to.equal('https://test.onion:443');
      profile.save(done);
    });

  });

  describe('@class ShardContract', function() {

    describe('@method checkAccessPolicy', function() {

      let contract1, contract2;

      before(() => {
        const renterHdKey = keyutils.toHDKeyFromSeed().deriveChild(1);
        const farmerHdKey = keyutils.toHDKeyFromSeed().deriveChild(1);

        contract1 = new database.ShardContract({
          ownerIdentity: keyutils.toPublicKeyHash(renterHdKey.publicKey)
                           .toString('hex'),
          providerIdentity: keyutils.toPublicKeyHash(farmerHdKey.publicKey)
                              .toString('hex'),
          ownerParentKey: renterHdKey.publicExtendedKey,
          providerParentKey: farmerHdKey.publicExtendedKey,
          ownerIndex: 1,
          providerIndex: 1,
          shardHash: crypto.createHash('rmd160').update('test').digest('hex'),
          shardSize: 4,
          accessPolicies: [
            '::RETRIEVE'
          ]
        });
        contract2 = new database.ShardContract({
          ownerIdentity: keyutils.toPublicKeyHash(renterHdKey.publicKey)
                           .toString('hex'),
          providerIdentity: keyutils.toPublicKeyHash(farmerHdKey.publicKey)
                              .toString('hex'),
          ownerParentKey: renterHdKey.publicExtendedKey,
          providerParentKey: farmerHdKey.publicExtendedKey,
          ownerIndex: 1,
          providerIndex: 1,
          shardHash: crypto.createHash('rmd160').update('test').digest('hex'),
          shardSize: 4,
          accessPolicies: [
            'G:xpub12345:RETRIEVE',
            'U:identity1:RETRIEVE'
          ]
        });
      });

      it('should allow the public object', function() {
        const allowed = contract1.checkAccessPolicy(
          ['anyone', { xpub: 'everyone' }]
        );
        expect(allowed.includes('RETRIEVE')).to.equal(true);
      });

      it('should not allow the public object', function() {
        const allowed = contract2.checkAccessPolicy(
          ['anyone', { xpub: 'everyone' }]
        );
        expect(allowed.includes('RETRIEVE')).to.equal(false);
      });

      it('should allow the user', function() {
        const allowed = contract2.checkAccessPolicy(
          ['identity1', { xpub: 'everyone' }]
        );
        expect(allowed.includes('RETRIEVE')).to.equal(true);
      });

      it('should allow the group', function() {
        const allowed = contract2.checkAccessPolicy(
          ['anyone', { xpub: 'xpub12345' }]
        );
        expect(allowed.includes('RETRIEVE')).to.equal(true);
      });

    });

  });

  describe('@class KadStorageAdapter', function() {

    let storage = null;

    before(() => {
      storage = new KadStorageAdapter(database.NetworkBlob);
    });

    describe('@method put', function() {

      it('should store the item in the database', function(done) {
        storage.put('foo', { value: 'bar' }, (err) => {
          expect(err).to.equal(null);
          storage.put('beep', { value: 'boop' }, (err) => {
            expect(err).to.equal(null);
            done();
          });
        })
      });

    });

    describe('@method get', function() {

      it('should fetch the item from the database', function(done) {
        storage.get('beep', (err, data) => {
          expect(data.value).to.equal('boop');
          done();
        });
      });

    });

    describe('@method createReadStream', function() {

      it('should emit the items in the database', function(done) {
        const rs = storage.createReadStream();
        rs.on('data', (data) => {
          expect(((data.key === 'foo') || (data.key === 'beep')))
            .to.equal(true);
          expect((data.value.value === 'bar') || (data.value.value === 'boop'))
            .to.equal(true);
        }).on('end', done);
      });

    });

    describe('@method del', function() {

      it('should delete the item from the database', function(done) {
        storage.del('foo', (err) => {
          expect(err).to.equal(null);
          done();
        });
      });

    });

  });

});
