'use strict';

const { EventEmitter } = require('events');
const { expect } = require('chai');
const sinon = require('sinon');
const { KademliaNode } = require('kad');
const { utils: keyutils } = require('kad-spartacus');
const utils = require('../lib/utils');
const Node = require('../lib/node');
const proxyquire = require('proxyquire');
const getDatabase = require('./fixtures/database');


let database = null;

function createNode(opts, NodeConstructor) {
  let Ctor = NodeConstructor || Node;

  const node = new Ctor({
    database,
    shards: opts.shards
  });

  return node;
}

describe('@class Node', function() {

  before((done) => {
    getDatabase((err, db) => {
      database = db;
      done(err);
    });
  });

  describe('@constructor', function() {

    const sandbox = sinon.sandbox.create();

    after(() => {
      sandbox.restore();
    });

    it('should plugin spartacus and quasar and server', function(done) {
      const plugin = sandbox.spy(Node.prototype, 'plugin');
      const node = createNode({});
      const serverUpload = sandbox.stub(node.server, 'upload');
      const serverDownload = sandbox.stub(node.server, 'download');
      expect(node).to.be.instanceOf(Node);
      expect(plugin.callCount).to.equal(3);
      node.transport.emit('download');
      node.transport.emit('upload');
      setImmediate(() => {
        expect(serverDownload.called).to.equal(true);
        expect(serverUpload.called).to.equal(true);
        done();
      });
    });

    it('should setup transport identify listener', function(done) {
      const node = createNode({});
      node.transport.emit('identify', {}, {
        end: (data) => {
          expect(JSON.parse(data)[0]).to.equal(node.identity.toString('hex'));
          done();
        }
      });
    });

  });

  describe('@method listen', function() {

    const sandbox = sinon.sandbox.create();

    after(() => {
      sandbox.restore();
    });

    it('should mount the protocol handlers and bind network', function() {
      const use = sinon.spy(Node.prototype, 'use');
      const listen = sandbox.stub(KademliaNode.prototype, 'listen');
      const node = createNode({});
      node.listen(0);
      expect(use.calledWithMatch('AUDIT')).to.equal(true);
      expect(use.calledWithMatch('CONSIGN')).to.equal(true);
      expect(use.calledWithMatch('MIRROR')).to.equal(true);
      expect(use.calledWithMatch('RETRIEVE')).to.equal(true);
      expect(use.calledWithMatch('RENEW')).to.equal(true);
      expect(listen.called).to.equal(true);
    });

  });

  describe('@method identifyService', function() {

    it('should callback error if bad status code', function(done) {
      const req = new EventEmitter();
      req.end = sinon.stub();
      const res = new EventEmitter();
      const Node = proxyquire('../lib/node', {
        https: {
          request: sinon.stub().callsArgWith(1, res).returns(req)
        }
      })
      const node = createNode({}, Node);
      node.onion = { createSecureAgent: sinon.stub() };
      node.identifyService('https://asdfghjkl.onion:443', (err) => {
        expect(err.message).to.equal('Service down');
        done();
      });
      setImmediate(() => {
        res.statusCode = 504;
        res.emit('data', 'Service down');
        res.emit('end');
      });
    });

    it('should callback error if cannot parse result', function(done) {
      const req = new EventEmitter();
      req.end = sinon.stub();
      const res = new EventEmitter();
      const Node = proxyquire('../lib/node', {
        https: {
          request: sinon.stub().callsArgWith(1, res).returns(req)
        }
      })
      const node = createNode({}, Node);
      node.onion = { createSecureAgent: sinon.stub() };
      node.identifyService('https://asdfghjkl.onion:443', (err) => {
        expect(err.message).to.equal('Failed to parse identity');
        done();
      });
      setImmediate(() => {
        res.statusCode = 200;
        res.emit('data', 'I am not a valid service');
        res.emit('end');
      });
    });

    it('should callback contact info', function(done) {
      const req = new EventEmitter();
      req.end = sinon.stub();
      const res = new EventEmitter();
      const Node = proxyquire('../lib/node', {
        https: {
          request: sinon.stub().callsArgWith(1, res).returns(req)
        }
      })
      const node = createNode({}, Node);
      node.onion = { createSecureAgent: sinon.stub() };
      node.identifyService('https://asdfghjkl.onion:443', (err, data) => {
        expect(data[0]).to.equal('identity');
        expect(data[1].contact).to.equal('data');
        done();
      });
      setImmediate(() => {
        res.statusCode = 200;
        res.emit('data', '["identity",{"contact":"data"}]');
        res.emit('end');
      });
    });

  });

  describe('@method authorizeRetrieval', function() {

    const sandbox = sinon.sandbox.create();

    after(() => {
      sandbox.restore();
    });

    it('should send a RETRIEVE RPC to the peer', function(done) {
      const node = createNode({});
      const send = sandbox.stub(node, 'send').callsArg(3);
      const peer = ['identity', { xpub: 'xpub' }];
      const hashes = ['one', 'two', 'three'];
      node.authorizeRetrieval(peer, hashes, () => {
        expect(send.calledWithMatch('RETRIEVE', hashes, peer)).to.equal(true);
        done();
      });
    });

  });

  describe('@method authorizeConsignment', function() {

    const sandbox = sinon.sandbox.create();

    after(() => {
      sandbox.restore();
    });

    it('should send a CONSIGN RPC to the peer', function(done) {
      const node = createNode({});
      const send = sandbox.stub(node, 'send').callsArg(3);
      const peer = ['identity', { xpub: 'xpub' }];
      const hashes = ['one', 'two', 'three'];
      node.authorizeConsignment(peer, hashes, () => {
        expect(send.calledWithMatch('CONSIGN', hashes, peer)).to.equal(true);
        done();
      });
    });

  });

  describe('@method createShardMirror', function() {

    const sandbox = sinon.sandbox.create();

    after(() => {
      sandbox.restore();
    });

    it('should send a MIRROR RPC to the peer', function(done) {
      const node = createNode({});
      const send = sandbox.stub(node, 'send').callsArg(3);
      const source = ['identity', { xpub: 'xpub' }];
      const target = {
        hash: 'hash',
        token: 'token',
        destination: ['identity', { xpub: 'xpub' }]
      };
      node.createShardMirror(source, target, () => {
        expect(send.calledWithMatch('MIRROR', [
          target.hash,
          target.token,
          target.destination
        ], source)).to.equal(true);
        done();
      });
    });

  });

  describe('@method auditRemoteShards', function() {

    const sandbox = sinon.sandbox.create();

    after(() => {
      sandbox.restore();
    });

    it('should send a AUDIT RPC to the peer', function(done) {
      const node = createNode({});
      const send = sandbox.stub(node, 'send').callsArg(3);
      const peer = ['identity', { xpub: 'xpub' }];
      const audits = [
        { hash: 'one', challenge: 'foo' },
        { hash: 'two', challenge: 'bar' },
        { hash: 'three', challenge: 'baz' }
      ];
      node.auditRemoteShards(peer, audits, () => {
        expect(send.calledWithMatch('AUDIT', audits, peer)).to.equal(true);
        done();
      });
    });

  });

  describe('@method requestContractRenewal', function() {

    const sandbox = sinon.sandbox.create();

    after(() => {
      sandbox.restore();
    });

    it('should callback error if peer returns one', function(done) {
      const node = createNode({});
      const peer = ['identity', { xpub: 'xpub' }];
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
        shardHash: utils.rmd160sha256(Buffer.from('test')).toString('hex'),
        shardSize: Buffer.from('test').length
      });
      const send = sandbox.stub(node, 'send').callsArgWith(
        3,
        new Error('Failed')
      );
      node.requestContractRenewal(peer, contract.toObject(), (err) => {
        expect(send.calledWithMatch('RENEW', [
          contract.toObject()
        ])).to.equal(true);
        expect(err.message).to.equal('Failed');
        done();
      });
    });

    it('should callback error if descriptor invalid', function(done) {
      const node = createNode({});
      const peer = ['identity', { xpub: 'xpub' }];
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
        shardHash: utils.rmd160sha256(Buffer.from('test')).toString('hex'),
        shardSize: 'invalid size'
      });
      const send = sandbox.stub(node, 'send').callsArgWith(
        3,
        null,
        [contract.toObject()]
      );
      node.requestContractRenewal(peer, contract.toObject(), (err) => {
        expect(send.calledWithMatch('RENEW', [
          contract.toObject()
        ])).to.equal(true);
        expect(err.message).to.equal(
          'Peer replied with invalid or incomplete contract'
        );
        done();
      });
    });

    it('should callback error if descriptor not complete', function(done) {
      const node = createNode({});
      const peer = ['identity', { xpub: 'xpub' }];
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
        shardHash: utils.rmd160sha256(Buffer.from('test')).toString('hex'),
        shardSize: 'invalid size'
      });
      const send = sandbox.stub(node, 'send').callsArgWith(
        3,
        null,
        [contract.toObject()]
      );
      node.requestContractRenewal(peer, contract.toObject(), (err) => {
        expect(send.calledWithMatch('RENEW', [
          contract.toObject()
        ])).to.equal(true);
        expect(err.message).to.equal(
          'Peer replied with invalid or incomplete contract'
        );
        done();
      });
    });

    it('should store the completed contract and callback', function(done) {
      const node = createNode({});
      const peer = ['identity', { xpub: 'xpub' }];
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
        shardHash: utils.rmd160sha256(Buffer.from('test')).toString('hex'),
        shardSize: Buffer.from('test').length
      });
      contract.sign('owner', renterHdKey.privateKey);
      contract.sign('provider', farmerHdKey.privateKey);
      const send = sandbox.stub(node, 'send').callsArgWith(
        3,
        null,
        [contract.toObject()]
      );
      node.requestContractRenewal(peer, contract.toObject(), () => {
        expect(send.calledWithMatch('RENEW', [
          contract.toObject()
        ])).to.equal(true);
        done();
      });
    });

  });

  describe('@method subscribeCapacityAnnouncement', function() {

    const sandbox = sinon.sandbox.create();

    after(() => sandbox.restore());

    it('should callback with capacity stream', function(done) {
      const node = createNode({});
      const quasarSubscribe = sandbox.stub(node, 'quasarSubscribe').callsFake(
        (c, h) => h([4096, ['identity', { xpub: 'xpubkey' }]])
      );
      node.subscribeCapacityAnnouncement((err, stream) => {
        expect(quasarSubscribe.args[0][0]).to.equal('ANNOUNCE');
        expect(stream.read()[0]).to.equal(4096);
        done();
      });
    });

  });

  describe('@method publishCapacityAnnouncement', function() {

    const sandbox = sinon.sandbox.create();

    after(() => sandbox.restore());

    it('should enable claims and publish bytes available', function(done) {
      const node = createNode({});
      const quasarPublish = sandbox.stub(node, 'quasarPublish').callsArg(2);
      node.publishCapacityAnnouncement(4096, () => {
        expect(quasarPublish.args[0][0]).to.equal('ANNOUNCE');
        expect(quasarPublish.args[0][1][0]).to.equal(4096);
        expect(quasarPublish.args[0][1][1][0]).to.equal(
          node.identity.toString('hex')
        );
        done();
      });
    });

  });

  describe('@method claimFarmerCapacity', function() {

    const sandbox = sinon.sandbox.create();

    after(() => sandbox.restore());

    it('should send a CLAIM RPC to the farmer', function(done) {
      const node = createNode({});
      const send = sandbox.stub(node, 'send').callsArg(3);
      const peer = ['identity', { xpub: 'xpubkey' }];
      const desc = {};
      node.claimFarmerCapacity(peer, desc, () => {
        expect(send.calledWithMatch('CLAIM', [desc], peer)).to.equal(true);
        done();
      });
    });

  });

});
