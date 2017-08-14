'use strict';

const { tmpdir } = require('os');
const path = require('path');
const { randomBytes } = require('crypto');
const { expect } = require('chai');
const Directory = require('../lib/directory');
const http = require('http');
const getDatabase = require('./fixtures/database');


describe('@class Directory', function() {

  let directory;

  before((done) => {
    getDatabase((err, database) => {
      directory = new Directory({ database }, {});
      directory.listen(0);

      let profile = new database.PeerProfile({
        identity: '00000000000000000000',
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

      profile.save(err => done(err));
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
        expect(data.identity).to.equal('00000000000000000000');
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

});
