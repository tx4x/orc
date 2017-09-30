'use strict';

const { expect } = require('chai');
const proxyquire = require('proxyquire');
const sinon = require('sinon');
const { tmpdir } = require('os');
const { EventEmitter} = require('events');


describe('@class Shards', function() {

  describe('@constructor', function() {

    it('should validate the directory', function() {
      const Shards = proxyquire('../lib/shards', {
        fs: {
          existsSync: sinon.stub().returns(true)
        }
      });
      const shards = new Shards(tmpdir());
      expect(shards.directory).to.equal(tmpdir());
    });

  });

  describe('@method createReadStream', function() {

    it('should callback error if cannot create stream', function(done) {
      const Shards = proxyquire('../lib/shards', {
        fs: {
          existsSync: sinon.stub().returns(true),
          createReadStream: sinon.stub().throws(new Error('Fail'))
        }
      });
      const shards = new Shards(tmpdir());
      shards.createReadStream('key', (err) => {
        expect(err.message).to.equal('Fail');
        done();
      });
    });

    it('should callback with created stream', function(done) {
      const stream = new EventEmitter();
      const Shards = proxyquire('../lib/shards', {
        fs: {
          existsSync: sinon.stub().returns(true),
          createReadStream: sinon.stub().returns(stream)
        }
      });
      const shards = new Shards(tmpdir());
      shards.createReadStream('key', (err, rs) => {
        expect(rs).to.equal(stream);
        done();
      });
      setImmediate(() => stream.emit('readable'));
    });

  });

  describe('@method createWriteStream', function() {

    it('should callback error if cannot create stream', function(done) {
      const Shards = proxyquire('../lib/shards', {
        fs: {
          existsSync: sinon.stub().returns(true),
          createWriteStream: sinon.stub().throws(new Error('Fail'))
        }
      });
      const shards = new Shards(tmpdir());
      shards.createWriteStream('key', (err) => {
        expect(err.message).to.equal('Fail');
        done();
      });
    });

    it('should callback with created stream', function(done) {
      const stream = {};
      const Shards = proxyquire('../lib/shards', {
        fs: {
          existsSync: sinon.stub().returns(true),
          createWriteStream: sinon.stub().returns(stream)
        }
      });
      const shards = new Shards(tmpdir());
      shards.createWriteStream('key', (err, rs) => {
        expect(rs).to.equal(stream);
        done();
      });
    });

  });

  describe('@method unlink', function() {

    it('should call fs#unlink', function(done) {
      const Shards = proxyquire('../lib/shards', {
        fs: {
          existsSync: sinon.stub().returns(true),
          unlink: sinon.stub().callsArg(1)
        }
      });
      const shards = new Shards(tmpdir());
      shards.unlink('key', done);
    });

  });

  describe('@method exists', function() {

    it('should callback with resuly of fs#existsSync', function(done) {
      const Shards = proxyquire('../lib/shards', {
        fs: {
          existsSync: sinon.stub().returns(true)
        }
      });
      const shards = new Shards(tmpdir());
      shards.exists('key', (err, exists) => {
        expect(exists).to.equal(true);
        done();
      });
    });

  });

  describe('@method size', function() {

    it('should callback error if du fails', function(done) {
      const Shards = proxyquire('../lib/shards', {
        fs: {
          existsSync: sinon.stub().returns(true)
        },
        du: sinon.stub().callsArgWith(1, new Error('Fail'))
      });
      const shards = new Shards(tmpdir());
      shards.size((err) => {
        expect(err.message).to.equal('Fail');
        done();
      });
    });

    it('should callback available 0 if used >= allocated', function(done) {
      const Shards = proxyquire('../lib/shards', {
        fs: {
          existsSync: sinon.stub().returns(true)
        },
        du: sinon.stub().callsArgWith(1, null, 1000)
      });
      const shards = new Shards(tmpdir(), { maxSpaceAllocated: 500 });
      shards.size((err, result) => {
        expect(result.allocated).to.equal(500);
        expect(result.available).to.equal(0);
        done();
      });
    });

    it('should callback available space', function(done) {
      const Shards = proxyquire('../lib/shards', {
        fs: {
          existsSync: sinon.stub().returns(true)
        },
        du: sinon.stub().callsArgWith(1, null, 1000)
      });
      const shards = new Shards(tmpdir(), { maxSpaceAllocated: 1500 });
      shards.size((err, result) => {
        expect(result.allocated).to.equal(1500);
        expect(result.available).to.equal(500);
        done();
      });
    });

  });

});
