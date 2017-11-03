'use strict';

const httpMocks = require('node-mocks-http');
const { expect } = require('chai');
const Bridge = require('../lib/bridge');
const sinon = require('sinon');
const EventEmitter = require('events');


describe('@class Bridge', function() {

  describe('@private @method _verifyClient', function() {

    it('should callback true if no creds defined', function(done) {
      let bridge = new Bridge({});
      bridge._verifyClient({
        req: { url: '/' }
      }, (result) => {
        expect(result).to.equal(true);
        done();
      });
    });

    it('should callback false if no creds supplied', function(done) {
      let bridge = new Bridge({}, { auth: { user: 'user', pass: 'pass' } });
      bridge._verifyClient({
        req: { url: '/' }
      }, (result) => {
        expect(result).to.equal(false);
        done();
      });
    });

    it('should callback true if creds match', function(done) {
      let bridge = new Bridge({}, { auth: { user: 'user', pass: 'pass' } });
      bridge._verifyClient({
        req: { url: '/?auth=' + Buffer.from('user:pass').toString('base64') }
      }, (result) => {
        expect(result).to.equal(true);
        done();
      });
    });

    it('should callback false if creds invalid', function(done) {
      let bridge = new Bridge({}, { auth: { user: 'user', pass: 'pass' } });
      bridge._verifyClient({
        req: { url: '/?auth=' + Buffer.from('resu:ssap').toString('base64') }
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
