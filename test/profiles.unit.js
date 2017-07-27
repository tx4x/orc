'use strict';

const { expect } = require('chai');
const profiles = require('../lib/profiles');
const sinon = require('sinon');
const { Readable: ReadableStream } = require('stream');
const Contract = require('../lib/contract');
const ms = require('ms');
const { randomBytes } = require('crypto');


describe('@class Profile', function() {

  it('should create a new shielded address', function(done) {
    let profile = new profiles.Profile({}, {
      WalletShieldedTransactions: '1'
    });
    sinon.stub(profile.wallet, 'z_getnewaddress')
      .resolves('shielded address');
    profile.getNewAddress((err, addr) => {
      expect(addr).to.equal('shielded address');
      done();
    });
  });

  it('should create a new transparent address', function(done) {
    let profile = new profiles.Profile({}, {
      WalletShieldedTransactions: '0'
    });
    sinon.stub(profile.wallet, 'getnewaddress')
      .resolves('transparent address');
    profile.getNewAddress((err, addr) => {
      expect(addr).to.equal('transparent address');
      done();
    });
  });

});

describe('@class FarmerProfile', function() {

  it('should initialize farmer profile', function(done) {
    let clock = sinon.useFakeTimers('setInterval');
    let info = sinon.stub();
    let warn = sinon.stub();
    let rs = new ReadableStream({ objectMode: true, read: () => null });
    let profile = new profiles.FarmerProfile({
      logger: { info, warn },
      subscribeShardDescriptor: sinon.stub().callsArgWith(1, null, rs),
      shards: {
        size: sinon.stub().callsArgWith(0, null, {
          allocated: 1000,
          available: 1000
        })
      },
      publishCapacityAnnouncement: sinon.stub().callsArg(2),
      offerShardAllocation: sinon.stub().callsArg(2),
      identity: '000000',
      contact: {
        xpub: '{xpub}',
        index: 0
      },
      spartacus: {
        privateKey: randomBytes(32)
      }
    }, {
      FarmerShardReaperInterval: '1H',
      FarmerAnnounceInterval: '2M',
      FarmerAdvertiseTopics: ['1', '2', '3'],
      WalletShieldedTransactions: '0'
    });
    let announceCapacity = sinon.spy(profile, 'announceCapacity');
    sinon.stub(profile.wallet, 'getnewaddress').resolves('address');
    setImmediate(() => {
      rs.push([Contract.from({}), ['{identity}', { hostname: 'test.onion' }]]);
      setTimeout(() => {
        clock.tick(ms('2M'));
        clock.restore();
        expect(profile.node.offerShardAllocation.called).to.equal(true);
        expect(announceCapacity.called).to.equal(true);
        done();
      }, 20);
    });
  });

  describe('@method reapExpiredShards', function() {

    it('should reap expired shards', function(done) {
      let contracts = [
        Contract.from({
          store_end: 0
        }).toObject(),
        Contract.from({
          store_end: Date.now() * 2
        }).toObject()
      ];
      let rs = new ReadableStream({
        read: function() {
          if (contracts.length) {
            this.push({
              key: 'key',
              value: contracts.shift()
            });
          } else {
            this.push(null);
          }
        },
        objectMode: true
      });
      let clock = sinon.useFakeTimers(Date.now(), 'setInterval');
      let info = sinon.stub();
      let warn = sinon.stub();
      let error = sinon.stub();
      let rs2 = new ReadableStream({ objectMode: true, read: () => null });
      let profile = new profiles.FarmerProfile({
        logger: { info, warn, error },
        subscribeShardDescriptor: sinon.stub().callsArgWith(1, null, rs2),
        shards: {
          size: sinon.stub().callsArgWith(0, null, {
            allocated: 1000,
            available: 1000
          }),
          unlink: sinon.stub().callsArg(1)
        },
        contracts: {
          createReadStream: sinon.stub().returns(rs),
          del: sinon.stub().callsArg(1)
        },
        publishCapacityAnnouncement: sinon.stub().callsArg(2),
        offerShardAllocation: sinon.stub().callsArg(2),
        identity: '000000',
        contact: {
          xpub: '{xpub}',
          index: 0
        },
        spartacus: {
          privateKey: randomBytes(32)
        }
      }, {
        FarmerShardReaperInterval: '1H',
        FarmerAnnounceInterval: '2M',
        FarmerAdvertiseTopics: ['1', '2', '3'],
        WalletShieldedTransactions: '0'
      });
      setImmediate(() => {
        clock.tick(ms('1H'));
        setTimeout(() => {
          clock.restore();
          expect(profile.node.shards.unlink.callCount).to.equal(1);
          expect(profile.node.contracts.del.callCount).to.equal(1);
          done();
        }, 20);
      });
    });

    it('should handle unlink error and bubble stream errors', function(done) {
      let contracts = [
        Contract.from({
          store_end: 0
        }).toObject(),
        Contract.from({
          store_end: Date.now() * 2
        }).toObject()
      ];
      let rs = new ReadableStream({
        read: function() {
          if (contracts.length === 2) {
            this.push({
              key: 'key',
              value: contracts.shift()
            });
          } else {
            this.emit('error', new Error('Failed'));
          }
        },
        objectMode: true
      });
      let clock = sinon.useFakeTimers(Date.now(), 'setInterval');
      let info = sinon.stub();
      let warn = sinon.stub();
      let error = sinon.stub();
      let rs2 = new ReadableStream({ objectMode: true, read: () => null });
      let profile = new profiles.FarmerProfile({
        logger: { info, warn, error },
        subscribeShardDescriptor: sinon.stub().callsArgWith(1, null, rs2),
        shards: {
          size: sinon.stub().callsArgWith(0, null, {
            allocated: 1000,
            available: 1000
          }),
          unlink: sinon.stub().callsFake((a, cb) => {
            cb(new Error('Failed to unlink'));
            rs.emit('error', new Error('Failed'));
          })
        },
        contracts: {
          createReadStream: sinon.stub().returns(rs),
          del: sinon.stub().callsArg(1)
        },
        publishCapacityAnnouncement: sinon.stub().callsArg(2),
        offerShardAllocation: sinon.stub().callsArg(2),
        identity: '000000',
        contact: {
          xpub: '{xpub}',
          index: 0
        },
        spartacus: {
          privateKey: randomBytes(32)
        }
      }, {
        FarmerShardReaperInterval: '1H',
        FarmerAnnounceInterval: '2M',
        FarmerAdvertiseTopics: ['1', '2', '3'],
        WalletShieldedTransactions: '0'
      });
      setImmediate(() => {
        clock.tick(ms('1H'));
        setTimeout(() => {
          clock.restore();
          expect(profile.node.shards.unlink.callCount).to.equal(1);
          expect(profile.node.contracts.del.callCount).to.equal(0);
          expect(profile.node.logger.error.calledWithMatch(
            'Failed'
          )).to.equal(true);
          done();
        }, 20);
      });
    });


  });

});

describe('@class RenterProfile', function() {

  it('should subscribe to capacity announcements and cache', function(done) {
    let info = sinon.stub();
    let rs = new ReadableStream({
      read: () => null,
      objectMode: true
    });
    let subscribeCapacityAnnouncement = sinon.stub().callsFake((t, cb) => {
      expect(t.includes('1')).to.equal(true);
      expect(t.includes('2')).to.equal(true);
      expect(t.includes('3')).to.equal(true);
      cb(null, rs);
    });
    let profile = new profiles.RenterProfile({
      logger: { info },
      subscribeCapacityAnnouncement,
      capacity: {
        set: function(key, val) {
          expect(key).to.equal('{identity}');
          expect(val.capacity.allocated).to.equal(1000);
          expect(val.capacity.available).to.equal(1000);
          expect(val.contact[0]).to.equal('{identity}');
          expect(val.contact[1].hostname).to.equal('test.onion');
          done();
        }
      }
    }, {
      RenterListenTopics: ['1', '2', '3']
    });
    expect(profile).to.be.instanceOf(profiles.RenterProfile);
    setImmediate(() => {
      expect(info.called).to.equal(true);
      rs.push([
        {
          allocated: 1000,
          available: 1000
        },
        [
          '{identity}',
          { hostname: 'test.onion' }
        ]
      ]);
    });
  });

});

describe('@class DirectoryProfile', function() {

  it('should subscribe to capacity announcements and cache', function(done) {
    let info = sinon.stub();
    let rs = new ReadableStream({
      read: () => null,
      objectMode: true
    });
    let subscribeCapacityAnnouncement = sinon.stub().callsFake((t, cb) => {
      expect(t.includes('1')).to.equal(true);
      expect(t.includes('2')).to.equal(true);
      expect(t.includes('3')).to.equal(true);
      cb(null, rs);
    });
    let profile = new profiles.DirectoryProfile({
      logger: { info },
      subscribeCapacityAnnouncement,
      capacity: {
        set: function(key, val) {
          expect(key).to.equal('{identity}');
          expect(val.capacity.allocated).to.equal(1000);
          expect(val.capacity.available).to.equal(1000);
          expect(val.contact[0]).to.equal('{identity}');
          expect(val.contact[1].hostname).to.equal('test.onion');
          done();
        }
      }
    }, {
      RenterListenTopics: ['1', '2', '3']
    });
    expect(profile).to.be.instanceOf(profiles.DirectoryProfile);
    setImmediate(() => {
      expect(info.called).to.equal(true);
      rs.push([
        {
          allocated: 1000,
          available: 1000
        },
        [
          '{identity}',
          { hostname: 'test.onion' }
        ]
      ]);
    });
  });

});

describe('@module profiles', function() {

  it('should return a farmer profile', function() {
    let profile = profiles.farmer({
      logger: { info: sinon.stub() },
      subscribeShardDescriptor: sinon.stub(),
      shards: { size: sinon.stub() }
    }, {
      FarmerAdvertiseTopics: [],
      FarmerAnnounceInterval: '1D',
      FarmerShardReaperInterval: '1D'
    });
    expect(profile).to.be.instanceOf(profiles.FarmerProfile);
  });

  it('should return a renter profile', function() {
    let profile = profiles.renter({
      logger: { info: sinon.stub() },
      subscribeCapacityAnnouncement: sinon.stub(),
    }, {});
    expect(profile).to.be.instanceOf(profiles.RenterProfile);
  });

  it('should return a directory profile', function() {
    let profile = profiles.directory({
      logger: { info: sinon.stub() },
      subscribeCapacityAnnouncement: sinon.stub(),
    }, {});
    expect(profile).to.be.instanceOf(profiles.DirectoryProfile);
  });

});
