'use strict';

const { expect } = require('chai');
const sinon = require('sinon');
const Directory = require('../lib/directory');
const http = require('http');
const getDatabase = require('./fixtures/database');
const { utils: keyutils } = require('kad-spartacus');
const async = require('async');


describe('@class Directory', function() {

  const reportAuditResults = sinon.stub().callsArg(1);

  let directory, profiles, reports;

  let key1 = keyutils.toHDKeyFromSeed(Buffer.from('1')).deriveChild(1);
  let key2 = keyutils.toHDKeyFromSeed(Buffer.from('2')).deriveChild(1);
  let key3 = keyutils.toHDKeyFromSeed(Buffer.from('3')).deriveChild(1);
  let key4 = keyutils.toHDKeyFromSeed(Buffer.from('4')).deriveChild(1);
  let key5 = keyutils.toHDKeyFromSeed(Buffer.from('5')).deriveChild(1);
  let key6 = keyutils.toHDKeyFromSeed(Buffer.from('6')).deriveChild(1);

  let identity1 = keyutils.toPublicKeyHash(key1.publicKey);
  let identity2 = keyutils.toPublicKeyHash(key2.publicKey);
  let identity3 = keyutils.toPublicKeyHash(key3.publicKey);
  let identity4 = keyutils.toPublicKeyHash(key4.publicKey);
  let identity5 = keyutils.toPublicKeyHash(key5.publicKey);
  let identity6 = keyutils.toPublicKeyHash(key6.publicKey);


  before((done) => {
    getDatabase((err, database) => {
      directory = new Directory({
        database,
        onion: {
          createSecureAgent: () => undefined
        },
        spartacus: {
          privateKey: key1.privateKey
        },
        reportAuditResults
      }, {});
      directory.listen(0);
      directory.bootstrapService = 'http://localhost:' +
        directory.server.address().port;

      let profile1 = new database.PeerProfile({
        identity: identity1.toString('hex'),
        contact: {
          hostname: 'test.onion',
          port: 443,
          protocol: 'https:',
          xpub: '{xpubkey}',
          index: 0,
          agent: 'orc-test/linux'
        },
        capacity: {
          allocated: 2000,
          available: 1000,
          timestamp: Date.now()
        },
        _reports: {
          missed: 0,
          streak: 10
        }
      });

      let profile2 = new database.PeerProfile({
        identity: identity2.toString('hex'),
        contact: {
          hostname: 'test.onion',
          port: 443,
          protocol: 'https:',
          xpub: '{xpubkey}',
          index: 0,
          agent: 'orc-test/linux'
        },
        capacity: {
          allocated: 2000,
          available: 1000,
          timestamp: Date.now() + 1000
        }
      });

      let profile3 = new database.PeerProfile({
        identity: identity3.toString('hex'),
        contact: {
          hostname: 'test.onion',
          port: 443,
          protocol: 'https:',
          xpub: '{xpubkey}',
          index: 0,
          agent: 'orc-test/linux'
        },
        capacity: {
          allocated: 2000,
          available: 1000,
          timestamp: Date.now()
        },
        _reports: {
          missed: 2,
          streak: 0
        }
      });

      let profile4 = new database.PeerProfile({
        identity: identity4.toString('hex'),
        contact: {
          hostname: 'test.onion',
          port: 443,
          protocol: 'https:',
          xpub: '{xpubkey}',
          index: 0,
          agent: 'orc-test/linux'
        },
        capacity: {
          allocated: 2000,
          available: 1000,
          timestamp: Date.now()
        }
      });

      let profile5 = new database.PeerProfile({
        identity: identity5.toString('hex'),
        contact: {
          hostname: 'test.onion',
          port: 443,
          protocol: 'https:',
          xpub: '{xpubkey}',
          index: 0,
          agent: 'orc-test/linux'
        },
        capacity: {
          allocated: 2000,
          available: 1000,
          timestamp: Date.now()
        }
      });

      let profile6 = new database.PeerProfile({
        identity: identity6.toString('hex'),
        contact: {
          hostname: 'test.onion',
          port: 443,
          protocol: 'https:',
          xpub: '{xpubkey}',
          index: 0,
          agent: 'orc-test/linux'
        },
        capacity: {
          allocated: 2000,
          available: 1000,
          timestamp: Date.now()
        }
      });

      profiles = [
        profile1,
        profile2,
        profile3,
        profile4,
        profile5,
        profile6
      ];

      reports = [

        // Profile 1 & 2 are both reliable and honest

        new database.AuditReport({
          reporter: profile1.identity,
          provider: profile2.identity,
          expected: '1111111111111111111111111111111111111111',
          actual: '1111111111111111111111111111111111111111',
          challenge: 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'
        }),
        new database.AuditReport({
          reporter: profile2.identity,
          provider: profile1.identity,
          expected: '1111111111111111111111111111111111111111',
          actual: '1111111111111111111111111111111111111111',
          challenge: 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'
        }),

        // Profile 3 didn't show up
        // Profile 4 is not reliable but is honest
        // Profile 1 & 5 are honest about Profile 4

        new database.AuditReport({
          reporter: profile4.identity,
          provider: profile5.identity,
          expected: '1111111111111111111111111111111111111111',
          actual: '1111111111111111111111111111111111111111',
          challenge: 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'
        }),
        new database.AuditReport({
          reporter: profile5.identity,
          provider: profile4.identity,
          expected: '1111111111111111111111111111111111111111',
          actual: '0000000000000000000000000000000000000000',
          challenge: 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'
        }),
        new database.AuditReport({
          reporter: profile1.identity,
          provider: profile4.identity,
          expected: '1111111111111111111111111111111111111111',
          actual: '0000000000000000000000000000000000000000',
          challenge: 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'
        }),



        new database.AuditReport({
          reporter: profile4.identity,
          provider: profile1.identity,
          expected: '1111111111111111111111111111111111111111',
          actual: '1111111111111111111111111111111111111111',
          challenge: 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'
        }),
        new database.AuditReport({
          reporter: profile5.identity,
          provider: profile1.identity,
          expected: '1111111111111111111111111111111111111111',
          actual: '1111111111111111111111111111111111111111',
          challenge: 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'
        }),
        new database.AuditReport({
          reporter: profile6.identity,
          provider: profile1.identity,
          expected: '1111111111111111111111111111111111111111',
          actual: '1111111111111111111111111111111111111111',
          challenge: 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'
        }),

        // Profile 6 lies about Profile 4 reliability
        // Profile 4 is honest about unreliable Profile 6

        new database.AuditReport({
          reporter: profile6.identity,
          provider: profile4.identity,
          expected: '1111111111111111111111111111111111111111',
          actual: '1111111111111111111111111111111111111111',
          challenge: 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'
        }),
        new database.AuditReport({
          reporter: profile4.identity,
          provider: profile6.identity,
          expected: '1111111111111111111111111111111111111111',
          actual: '0000000000000000000000000000000000000000',
          challenge: 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'
        }),
        new database.AuditReport({
          reporter: profile6.identity,
          provider: profile4.identity,
          expected: '1111111111111111111111111111111111111111',
          actual: '1111111111111111111111111111111111111111',
          challenge: 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'
        }),
        new database.AuditReport({
          reporter: profile4.identity,
          provider: profile6.identity,
          expected: '1111111111111111111111111111111111111111',
          actual: '1111111111111111111111111111111111111111',
          challenge: 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'
        }),

        // Extra exchange for Profile 1 & 2 (both are high utilization users)

        new database.AuditReport({
          reporter: profile1.identity,
          provider: profile2.identity,
          expected: '1111111111111111111111111111111111111111',
          actual: '1111111111111111111111111111111111111111',
          challenge: 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'
        }),
        new database.AuditReport({
          reporter: profile2.identity,
          provider: profile1.identity,
          expected: '1111111111111111111111111111111111111111',
          actual: '1111111111111111111111111111111111111111',
          challenge: 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'
        })
      ];

      async.each(
        profiles.concat(reports),
        (doc, done) => doc.save(done),
        done
      );
    });
  });

  it('should respond with the directory contents', function(done) {
    let { port } = directory.server.address();
    http.get(`http://localhost:${port}`, (res) => {
      let data = '';
      res.on('data', (d) => data += d.toString());
      res.on('end', () => {
        data = JSON.parse(data)[0];
        expect(data.capacity.allocated).to.equal(2000);
        expect(data.capacity.available).to.equal(1000);
        expect(data.identity).to.equal(profiles[1].identity.toString('hex'));
        expect(data.contact.hostname).to.equal('test.onion');
        expect(data.contact.port).to.equal(443);
        expect(data.contact.protocol).to.equal('https:');
        expect(data.contact.xpub).to.equal('{xpubkey}');
        expect(data.contact.index).to.equal(0);
        expect(data.contact.agent).to.equal('orc-test/linux');
        done();
      });
    });
  });

  it('should succeed in boostrapping from another directory', function(done) {
    let spy = sinon.spy(directory.database.PeerProfile, 'findOneAndUpdate');
    directory.bootstrap((err) => {
      expect(err).to.equal(null);
      expect(spy.callCount).to.equal(6);
      done();
    });
  });

  it('should score the peer profiles based on audits', function(done) {
    directory.scoreAndPublishAuditReports((err) => {
      expect(err).to.equal(null);
      expect(reportAuditResults.called).to.equal(true);
      directory.database.PeerProfile.find({}, (err, profiles) => {
        let map = new Map();
        profiles.forEach((p) => map.set(p.identity, p.reputation.score));
        expect(map.get(identity1.toString('hex'))).to.equal(9);
        expect(map.get(identity2.toString('hex'))).to.equal(4);
        expect(map.get(identity3.toString('hex'))).to.equal(0);
        expect(map.get(identity4.toString('hex'))).to.equal(4);
        expect(map.get(identity5.toString('hex'))).to.equal(2);
        expect(map.get(identity6.toString('hex'))).to.equal(3);
        done();
      });
    });
  });

});
