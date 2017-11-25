'use strict';

const { expect } = require('chai');
const sinon = require('sinon');
const http = require('http');
const getDatabase = require('./fixtures/database');
const { utils: keyutils } = require('kad-spartacus');
const async = require('async');
const httpMocks = require('node-mocks-http');
const Bridge = require('../lib/bridge');
const EventEmitter = require('events');


describe('@class Bridge', function() {

  const reportAuditResults = sinon.stub().callsArg(1);

  let bridge, profiles, reports;

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

  before(function(done) {
    this.timeout(8000);
    getDatabase((err, database) => {
      bridge = new Bridge({
        database,
        onion: {
          createSecureAgent: () => undefined
        },
        spartacus: {
          privateKey: key1.privateKey
        },
        reportAuditResults
      }, {});
      bridge.listen(0);

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

      async.eachSeries(
        profiles.concat(reports),
        (d, done) => d.save(done),
        done
      );
    });
  });

  after((done) => {
    bridge.database.AuditReport.remove(() => {
      bridge.database.PeerProfile.remove(done);
    });
  });

  it('should respond with the providers', function(done) {
    let { port } = bridge.server.address();
    http.get(`http://localhost:${port}/providers`, (res) => {
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

  it('should respond with profile requested', function(done) {
    let { port } = bridge.server.address();
    let identity = identity1.toString('hex');
    http.get(`http://localhost:${port}/providers/${identity}`, (res) => {
      let data = '';
      res.on('data', (d) => data += d.toString());
      res.on('end', () => {
        data = JSON.parse(data);
        expect(data.capacity.allocated).to.equal(2000);
        expect(data.capacity.available).to.equal(1000);
        expect(data.identity).to.equal(profiles[0].identity.toString('hex'));
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

  it('should respond with not found', function(done) {
    let { port } = bridge.server.address();
    http.get(`http://localhost:${port}/providers/invalid`, (res) => {
      let data = '';
      res.on('data', (d) => data += d.toString());
      res.on('end', () => {
        expect(res.statusCode).to.equal(404);
        expect(data).to.equal('Profile not known');
        done();
      });
    });
  });

  it('should score the peer profiles based on audits', function(done) {
    bridge.scoreAndPublishAuditReports((err) => {
      expect(err).to.equal(null);
      expect(reportAuditResults.called).to.equal(true);
      bridge.database.PeerProfile.find({}, (err, profiles) => {
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

  it('should place peers in percentiles and define allowance', function(done) {
    let { port } = bridge.server.address();
    async.mapSeries([
      identity1.toString('hex'),
      identity2.toString('hex'),
      identity3.toString('hex'),
      identity4.toString('hex'),
      identity5.toString('hex'),
      identity6.toString('hex')
    ], (id, next) => {
      http.get(`http://localhost:${port}/providers/${id}/score`, (res) => {
        let data = '';
        res.on('data', (d) => data += d.toString());
        res.on('end', () => {
          if (res.statusCode !== 200) {
            return next(new Error(data));
          }

          try {
            data = JSON.parse(data);
          } catch (err) {
            return next(new Error(data || err.message));
          }

          next(null, data);
        });
      });
    }, (err, scores) => {
      if (err) {
        return done(err);
      }

      let expected = [
        [1, 4500],
        [0.44, 240],
        [0, 300],
        [0.44, 240],
        [0.22, 600],
        [0.33, 400]
      ];

      expected.forEach(([perc, avail], i) => {
        expect(scores[i].percentile).to.equal(perc);
        expect(scores[i].allowance).to.equal(avail);
      });

      done();
    });
  });

  describe('@private @method _verifyClient', function() {

    it('should callback true if no creds defined', function(done) {
      let bridge = new Bridge({});
      bridge._verifyClient({
        req: { url: '/', headers: {} }
      }, (result) => {
        expect(result).to.equal(true);
        done();
      });
    });

    it('should callback false if no creds supplied', function(done) {
      let bridge = new Bridge({}, { auth: { user: 'user', pass: 'pass' } });
      bridge._verifyClient({
        req: { url: '/', headers: {} }
      }, (result) => {
        expect(result).to.equal(false);
        done();
      });
    });

    it('should callback true if creds match', function(done) {
      let bridge = new Bridge({}, { auth: { user: 'user', pass: 'pass' } });
      bridge._verifyClient({
        req: {
          headers: {
            authorization: 'Basic ' +
              Buffer.from('user:pass').toString('base64')
          }
        }
      }, (result) => {
        expect(result).to.equal(true);
        done();
      });
    });

    it('should callback false if creds invalid', function(done) {
      let bridge = new Bridge({}, { auth: { user: 'user', pass: 'pass' } });
      bridge._verifyClient({
        req: {
          headers: {
            authorization: 'Basic ' +
              Buffer.from('user:nope').toString('base64')
          }
        }
      }, (result) => {
        expect(result).to.equal(false);
        done();
      });
    });

  });

  describe('@method listen', function() {

    it('should start server and bridge control port', function(done) {
      let bridge = new Bridge({}, {});
      let listen = sinon.stub(bridge.server, 'listen');
      bridge.listen(0);
      setImmediate(() => {
        let sock = new EventEmitter();
        bridge.wss.emit('connection', sock);
        setImmediate(() => {
          expect(listen.called).to.equal(true);
          done();
        });
      });
    });

  });

  describe('@method authenticate', function() {

    it('should pass along if no auth defined', function(done) {
      let { req, res } = httpMocks.createMocks({
        method: 'GET',
        path: '/',
        headers: {}
      }, {});
      let bridge = new Bridge({});
      bridge.authenticate(req, res, done);
    });

    it('should pass along if auth valid', function(done) {
      let { req, res } = httpMocks.createMocks({
        method: 'GET',
        path: '/',
        headers: {
          'Authorization': 'Basic ' +
            Buffer.from('user:pass').toString('base64')
        }
      }, {});
      let bridge = new Bridge({}, { auth: { user: 'user', pass: 'pass' } });
      bridge.authenticate(req, res, done);
    });

    it('should reject if auth not valid', function(done) {
      let { req, res } = httpMocks.createMocks({
        method: 'GET',
        path: '/',
        headers: {
          'Authorization': 'Basic ' +
            Buffer.from('ssap:resu').toString('base64')
        }
      }, {});
      let bridge = new Bridge({}, { auth: { user: 'user', pass: 'pass' } });
      bridge.authenticate(req, res, (err) => {
        expect(err.message).to.equal('Not authorized');
        done();
      });
    });

  });

  describe('@method error', function() {

    it('should pass on if no error', function(done) {
      let bridge = new Bridge({});
      bridge.error(null, {}, {}, done);
    });

    it('should respond with error message', function(done) {
      let bridge = new Bridge({});
      let writeHead = sinon.stub();
      let end = sinon.stub();
      let write = sinon.stub();
      bridge.error(new Error('Not authorized'), {}, {
        end, write, writeHead
      });
      expect(writeHead.calledWithMatch(500)).to.equal(true);
      expect(write.calledWithMatch('Not authorized')).to.equal(true);
      expect(end.called).to.equal(true);
      done();
    });

  });

});
