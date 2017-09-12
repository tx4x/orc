'use strict';

const path = require('path');
const { tmpdir } = require('os');
const crypto = require('crypto');
const { expect } = require('chai');
const sinon = require('sinon');
const mkdirp = require('mkdirp');
const http = require('http');
const Bridge = require('../lib/bridge');
const Node = require('../lib/node');
const Shards = require('../lib/shards');
const FormData = require('form-data');
const utils = require('../lib/utils');
const stream = require('stream');
const { EventEmitter } = require('events');
const bunyan = require('bunyan');
const ws = require('ws');
const boscar = require('boscar');
const getDatabase = require('./fixtures/database');
const url = require('url');
const qs = require('querystring');
const { utils: keyutils } = require('kad-spartacus');


describe('@class Bridge (integration)', function() {

  let sandbox = sinon.sandbox.create();
  let clock = sandbox.useFakeTimers('setTimeout', 'setInterval');
  let shardsdir = path.join(tmpdir(), crypto.randomBytes(6).toString('hex'));
  let file = crypto.randomBytes(3000);
  let id = null;
  let magnet = null;

  mkdirp.sync(shardsdir);

  let node = null;
  let bridge = null;
  let port = 0;
  let shards = {};

  before((done) => {
    sandbox.stub(utils, 'createShardUploader').callsFake((t, h) => {
      let uploader = new stream.Transform({
        write: function(d, e, cb) {
          shards[h] = d;
          cb();
        },
        flush: function(cb) {
          let uploadResponse = new EventEmitter();
          uploadResponse.statusCode = 200;
          this.emit('response', uploadResponse);
          setTimeout(() => {
            uploadResponse.emit('data', 'Success');
            uploadResponse.emit('end');
          }, 20);
          cb();
        }
      });
      return uploader;
    });
    sandbox.stub(utils, 'createShardDownloader').callsFake((t, h) => {
      let done = false;
      let buf = shards[h];
      let downloader = new stream.Readable({
        read: function() {
          if (done) {
            this.push(null);
          } else {
            done = true;
            this.push(buf);
          }
        }
      });
      return downloader;
    });
    getDatabase((err, database) => {
      if (err) {
        return done(err);
      }
      node = new Node({
        logger: bunyan.createLogger({
          name: 'bridge/integration/logger',
          level: 'fatal'
        }),
        shards: new Shards(shardsdir),
        database
      });
      bridge = new Bridge(node, {
        auth: {
          user: 'orctest',
          pass: 'orctest'
        },
        control: new boscar.Server(node)
      });
      node.iterativeFindValue = function(key, callback) {
        database.NetworkBlob.findOne({ key }, (err, obj) => {
          callback(err, obj ? [obj.toObject()] : []);
        });
      };
      let profile = new database.PeerProfile({
        identity: 'ca458055841255795bfc2e2b6e6480dd2ea80506',
        capacity: {
          allocated: 5000,
          available: 4500,
          timestamp: Date.now()
        },
        contact: {
          protocol: 'https:',
          port: 443,
          hostname: 'integration-test.onion',
          xpub: 'xpub',
          index: 0
        }
      });
      profile.save(err => {
        if (err) {
          return done(err);
        }
        bridge.listen(0, () => {
          port = bridge.server.address().port;
          done();
        });
      });
    });
  });

  after(() => sandbox.restore());

  it('should start audit interval', function(done) {
    let audit = sinon.spy(bridge, 'audit');
    clock.tick(21600005);
    setImmediate(() => {
      audit.restore();
      clock.restore();
      expect(audit.called).to.equal(true);
      done();
    });
  });

  it('should respond with no objects stored', function(done) {
    let body = '';
    let req = http.request({
      auth: 'orctest:orctest',
      hostname: 'localhost',
      port,
      path: '/',
      headers: { Accept: 'application/json' }
    });
    req.on('response', (res) => {
      res.on('data', (data) => body += data.toString());
      res.on('end', () => {
        body = JSON.parse(body);
        expect(body).to.have.lengthOf(0);
        done();
      });
    });
    req.end();
  });

  it('should upload the file to the hosts', function(done) {
    let claimFarmerCapacity = sandbox.stub(
      node,
      'claimFarmerCapacity'
    ).callsFake(function(a, b, cb) {
      let key = keyutils.toHDKeyFromSeed().deriveChild(1);
      b.providerIdentity = keyutils.toPublicKeyHash(key.publicKey)
        .toString('hex');
      b.providerIndex = 1;
      b.providerParentKey = key.publicExtendedKey;
      let complete = new bridge.database.ShardContract(b);
      complete.sign('provider', key.privateKey);
      cb(null, [complete.toObject(), 'token']);
    });
    node.onion = { createSecureAgent: sandbox.stub() };
    let form = new FormData();
    form.append('policy', '::RETRIEVE');
    form.append('file', file, {
      filename: 'random-bytes',
      filepath: '/dev/random',
      contentType: 'application/octet-stream',
      knownLength: 3000
    });
    form.submit({
      hostname: 'localhost',
      port,
      path: '/',
      method: 'POST',
      auth: 'orctest:orctest'
    }, (err, res) => {
      claimFarmerCapacity.restore();
      expect(res.statusCode).to.equal(201);
      expect(node.onion.createSecureAgent.callCount).to.equal(3);
      let body = '';
      res.on('data', (data) => body += data);
      res.on('end', () => {
        body = JSON.parse(body);
        id = body.id;
        expect(body.shards).to.have.lengthOf(3);
        expect(body.shards[0].size).to.equal(1504);
        expect(body.shards[1].size).to.equal(1504);
        expect(body.shards[2].size).to.equal(1504);
        expect(body.status).to.equal('finished');
        expect(body.mimetype).to.equal('application/octet-stream');
        expect(body.name).to.equal('random');
        done();
      });
    });
  });

  it('should fetch the magnet link for the object', function(done) {
    let body = '';
    let req = http.request({
      auth: 'orctest:orctest',
      hostname: 'localhost',
      port,
      path: `/${id}/magnet`
    });
    req.on('response', (res) => {
      res.on('data', (data) => body += data.toString());
      res.on('end', () => {
        let { href } = JSON.parse(body);
        magnet = href;
        href = url.parse(href);
        let query = qs.parse(href.query);
        let params = Object.keys(query);
        expect(params.includes('xt')).to.equal(true);
        expect(params.includes('xs')).to.equal(true);
        expect(params.includes('dn')).to.equal(true);
        expect(params.includes('x.ecprv')).to.equal(true);
        expect(params.includes('x.pword')).to.equal(true);
        done();
      });
    });
    req.end();
  });

  it('should resolve the encrypted pointer and save it', function(done) {
    let body = '';
    let req = http.request({
      auth: 'orctest:orctest',
      hostname: 'localhost',
      port,
      path: '/',
      method: 'PUT'
    });
    req.on('response', (res) => {
      res.on('data', (data) => body += data.toString());
      res.on('end', () => {
        body = JSON.parse(body);
        expect(body.size).to.equal(3000);
        expect(body.shards.length).to.equal(3);
        expect(body.shards).to.have.lengthOf(3);
        expect(body.shards[0].size).to.equal(1504);
        expect(body.shards[1].size).to.equal(1504);
        expect(body.shards[2].size).to.equal(1504);
        expect(body.status).to.equal('finished');
        expect(body.mimetype).to.equal('application/octet-stream');
        expect(body.name).to.equal('random');
        done();
      });
    });
    req.end(magnet);
  });

  it('should fail to upload if error loading capacity', function(done) {
    let findQuery = sandbox.stub(
      node.database.PeerProfile,
      'find'
    ).callsArgWith(1, new Error('Failed'));
    node.onion = { createSecureAgent: sandbox.stub() };
    let form = new FormData();
    form.append('file', file, {
      filename: 'random-bytes',
      filepath: '/dev/random',
      contentType: 'application/octet-stream',
      knownLength: 3000
    });
    form.submit({
      hostname: 'localhost',
      port,
      path: '/',
      method: 'POST',
      auth: 'orctest:orctest'
    }, (err, res) => {
      findQuery.restore();
      expect(res.statusCode).to.equal(500);
      let body = '';
      res.on('data', (data) => body += data);
      res.on('end', () => {
        expect(body).to.equal('Not enough capacity information');
        done();
      });
    });
  });

  it('should fail to upload cannot claim capacity', function(done) {
    let claimFarmerCapacity = sandbox.stub(
      node,
      'claimFarmerCapacity'
    ).callsArgWith(2, new Error('Cannot claim capacity'));
    node.onion = { createSecureAgent: sandbox.stub() };
    let form = new FormData();
    form.append('file', file, {
      filename: 'random-bytes',
      filepath: '/dev/random',
      contentType: 'application/octet-stream',
      knownLength: 3000
    });
    form.submit({
      hostname: 'localhost',
      port,
      path: '/',
      method: 'POST',
      auth: 'orctest:orctest'
    }, (err, res) => {
      claimFarmerCapacity.restore();
      expect(res.statusCode).to.equal(500);
      let body = '';
      res.on('data', (data) => body += data);
      res.on('end', () => {
        expect(body).to.equal('Cannot claim capacity');
        done();
      });
    });
  });

  it('should respond with 4 objects', function(done) {
    let body = '';
    let req = http.request({
      auth: 'orctest:orctest',
      hostname: 'localhost',
      port,
      path: '/',
      headers: { Accept: 'application/json' }
    });
    req.on('response', (res) => {
      res.on('data', (data) => body += data.toString());
      res.on('end', () => {
        body = JSON.parse(body);
        id = body[0].id;
        expect(body).to.have.lengthOf(4);
        expect(body[0].shards).to.have.lengthOf(3);
        expect(body[0].shards[0].size).to.equal(1504);
        expect(body[0].shards[1].size).to.equal(1504);
        expect(body[0].shards[2].size).to.equal(1504);
        expect(body[0].status).to.equal('finished');
        expect(body[0].mimetype).to.equal('application/octet-stream');
        expect(body[0].name).to.equal('random');
        done();
      });
    });
    req.end();

  });

  it('should download the file requested and repair', function(done) {
    let authorizeRetrieval = sandbox.stub(
      node,
      'authorizeRetrieval'
    ).callsArgWith(2, null, ['token']);
    authorizeRetrieval
      .onCall(1)
      .callsFake((a, b, cb) => {
        cb(new Error('Timeout'));
      });
    let body = Buffer.from([]);
    let req = http.request({
      auth: 'orctest:orctest',
      hostname: 'localhost',
      port,
      path: `/${id}`
    });
    req.on('response', (res) => {
      res.on('data', (data) => body = Buffer.concat([body, data]));
      res.on('end', () => {
        authorizeRetrieval.restore();
        expect(authorizeRetrieval.callCount).to.equal(3);
        expect(Buffer.compare(body, file)).to.equal(0);
        done();
      });
    });
    req.end();
  });

  it('should download the file requested and repair', function(done) {
    let authorizeRetrieval = sandbox.stub(
      node,
      'authorizeRetrieval'
    ).callsArgWith(2, null, ['token']);
    utils.createShardDownloader
      .resetHistory()
      .onCall(2)
      .callsFake(() => {
        let downloader = new stream.Readable({
          read: function() {
            this.emit('error', new Error('Failed'));
          }
        });
        return downloader;
      });
    let body = Buffer.from([]);
    let req = http.request({
      auth: 'orctest:orctest',
      hostname: 'localhost',
      port,
      path: `/${id}`
    });
    req.on('response', (res) => {
      res.on('data', (data) => body = Buffer.concat([body, data]));
      res.on('end', () => {
        authorizeRetrieval.restore();
        expect(authorizeRetrieval.callCount).to.equal(3);
        expect(Buffer.compare(body, file)).to.equal(0);
        done();
      });
    });
    req.end();
  });

  it('should audit, rebuilt, and regenerate challenges', function(done) {
    let auditRemoteShards = sandbox.stub(node, 'auditRemoteShards');
    auditRemoteShards.onCall(0).callsArgWith(2, null, [
      /* stub expected proof structure */
    ]);
    auditRemoteShards.onCall(1).callsArgWith(2, null, [
      /* stub expected proof structure */
    ]);
    auditRemoteShards.onCall(2).callsArgWith(2, null, [
      /* stub expected proof structure */
    ]);
    let eventTriggered = false;
    node.database.ObjectPointer.findOne({}, (err, obj) => {
      obj._lastAuditTimestamp = 0;
      obj.shards[0].decayed = true;
      obj.shards[0].audits.challenges = obj.shards[0].audits.challenges[0];
      obj.save((err) => {
        bridge.on('auditInternalFinished', () => eventTriggered = true);
        bridge.audit((err) => {
          expect(eventTriggered).to.equal(true);
          done();
        });
      });
    });
  });

  it('should delete the object stored', function(done) {
    let req = http.request({
      auth: 'orctest:orctest',
      hostname: 'localhost',
      port,
      path: `/${id}`,
      method: 'DELETE'
    });
    req.on('response', (res) => {
      expect(res.statusCode).to.equal(201);
      done();
    });
    req.end();
  });

  it('should respond with 3 objects', function(done) {
    let body = '';
    let req = http.request({
      auth: 'orctest:orctest',
      hostname: 'localhost',
      port,
      path: '/',
      headers: { Accept: 'application/json' }
    });
    req.on('response', (res) => {
      res.on('data', (data) => body += data.toString());
      res.on('end', () => {
        body = JSON.parse(body);
        expect(body).to.have.lengthOf(3);
        done();
      });
    });
    req.end();
  });

  it('should proxy websocket to control port', function(done) {
    let ping = sandbox.stub(node, 'ping').callsArgWith(1, null, []);
    let creds = Buffer.from('orctest:orctest').toString('base64');
    let sock = new ws(`http://localhost:${port}?auth=${creds}`);
    sock.on('open', () => {
      sock.on('message', (data) => {
        data = JSON.parse(data);
        expect(ping.callCount).to.equal(1);
        expect(data.result).to.have.lengthOf(1);
        done();
      });
      sock.send(JSON.stringify({
        jsonrpc: '2.0',
        id: 'rpctest',
        method: 'ping',
        params: [
          ['{ identity }', { contact: 'data' }]
        ]
      }) + '\r\n');
    });
  });

});
