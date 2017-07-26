'use strict';

const path = require('path');
const { tmpdir } = require('os');
const crypto = require('crypto');
const { expect } = require('chai');
const sinon = require('sinon');
const levelup = require('levelup');
const memdown = require('memdown');
const mkdirp = require('mkdirp');
const http = require('http');
const Tiny = require('tiny');
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


describe('@class Bridge (integration)', function() {

  let sandbox = sinon.sandbox.create();
  let clock = sandbox.useFakeTimers('setTimeout', 'setInterval');
  let capacityCache = new Tiny(
    path.join(tmpdir(), crypto.randomBytes(6).toString('hex'))
  );
  let shardsdir = path.join(tmpdir(), crypto.randomBytes(6).toString('hex'));
  let file = crypto.randomBytes(3000);
  let id = null;

  mkdirp.sync(shardsdir);

  let node = new Node({
    logger: bunyan.createLogger({
      name: 'bridge/integration/logger',
      level: 'fatal'
    }),
    contracts: levelup('bridge/integration/contracts', { db: memdown }),
    shards: new Shards(shardsdir),
    storage: levelup('bridge/integration/storage', { db: memdown })
  });
  let bridge = new Bridge(node, {
    capacityCache,
    auth: {
      user: 'orctest',
      pass: 'orctest'
    },
    control: new boscar.Server(node)
  });
  let port = 0;
  let shards = [];
  let createUploader = null;
  let createDownloader = null

  before((done) => {
    createUploader = sandbox.stub(utils, 'createShardUploader', () => {
      let uploader = new stream.Transform({
        write: function(d, e, cb) {
          shards.push(d);
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
    createDownloader = sandbox.stub(utils, 'createShardDownloader', () => {
      let done = false;
      let buf = shards.shift();
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
    capacityCache.set('ca458055841255795bfc2e2b6e6480dd2ea80506', {
      capacity: {
        allocated: 5000,
        available: 4500
      },
      timestamp: Date.now(),
      contact: [
        'ca458055841255795bfc2e2b6e6480dd2ea80506',
        {
          protocol: 'https:',
          port: 443,
          hostname: 'integration-test.onion'
        }
      ]
    }, () => {
      bridge.listen(0, () => {
        port = bridge.server.address().port;
        done();
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
      path: '/'
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
    ).callsArgWith(2, null, [{ contract: 'test' }, 'token']);
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
      expect(res.statusCode).to.equal(201);
      expect(node.onion.createSecureAgent.callCount).to.equal(3);
      let body = '';
      res.on('data', (data) => body += data);
      res.on('end', () => {
        body = JSON.parse(body);
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

  it('should fail to upload if error loading capacity', function(done) {
    let findQuery = sandbox.stub(
      bridge.capacityCache,
      'find'
    ).returns(sinon.stub().callsArgWith(0, new Error('Failed')));
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

  it('should respond with 3 objects', function(done) {
    let body = '';
    let req = http.request({
      auth: 'orctest:orctest',
      hostname: 'localhost',
      port,
      path: '/'
    });
    req.on('response', (res) => {
      res.on('data', (data) => body += data.toString());
      res.on('end', () => {
        body = JSON.parse(body);
        id = body[0].id;
        expect(body).to.have.lengthOf(3);
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

  it('should download the file requested', function(done) {
    let authorizeRetrieval = sandbox.stub(
      node,
      'authorizeRetrieval'
    ).callsArgWith(2, null, ['token']);
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
        expect(authorizeRetrieval.callCount).to.equal(3);
        expect(Buffer.compare(body, file)).to.equal(0);
        done();
      });
    });
    req.end();
  });

  it('should delete the object stored', function(done) {
    let requestContractRenewal = sandbox.stub(
      node,
      'requestContractRenewal'
    ).callsArgWith(2);
    let req = http.request({
      auth: 'orctest:orctest',
      hostname: 'localhost',
      port,
      path: `/${id}`,
      method: 'DELETE'
    });
    req.on('response', (res) => {
      expect(res.statusCode).to.equal(201);
      expect(requestContractRenewal.callCount).to.equal(3);
      done();
    });
    req.end();
  });

  it('should respond with 2 objects', function(done) {
    let body = '';
    let req = http.request({
      auth: 'orctest:orctest',
      hostname: 'localhost',
      port,
      path: '/'
    });
    req.on('response', (res) => {
      res.on('data', (data) => body += data.toString());
      res.on('end', () => {
        body = JSON.parse(body);
        expect(body).to.have.lengthOf(2);
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
