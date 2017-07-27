'use strict';

const { expect } = require('chai');
const profiles = require('../lib/profiles');
const sinon = require('sinon');
const { Readable: ReadableStream } = require('stream');


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
