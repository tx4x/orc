'use strict';

const { tmpdir } = require('os');
const path = require('path');
const { randomBytes } = require('crypto');
const Tiny = require('tiny');
const { expect } = require('chai');
const Directory = require('../lib/directory');
const http = require('http');


describe('@class Directory', function() {

  let capacityCache = new Tiny(path.join(
    tmpdir(),
    `orc-test-tmp-directory-${randomBytes(8).toString('hex')}`
  ));
  let directory;

  before((done) => {
    directory = new Directory({}, { capacityCache });
    directory.listen(0);
    capacityCache.set('{identity 2}', {
      capacity: {
        available: 1000,
        allocated: 2000
      },
      contact: [
        '{identity 2}',
        {
          hostname: 'test.onion',
          port: 443,
          protocol: 'https:',
          xpub: '{xpubkey}',
          index: 0,
          agent: 'orc-test/linux'
        }
      ],
      timestamp: Date.now() - 1000
    });
    capacityCache.set('{identity 1}', {
      capacity: {
        available: 1000,
        allocated: 2000
      },
      contact: [
        '{identity 1}',
        {
          hostname: 'test.onion',
          port: 443,
          protocol: 'https:',
          xpub: '{xpubkey}',
          index: 0,
          agent: 'orc-test/linux'
        }
      ],
      timestamp: Date.now()
    }, done);
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
        expect(data.contact[0]).to.equal('{identity 1}');
        expect(data.contact[1].hostname).to.equal('test.onion');
        expect(data.contact[1].port).to.equal(443);
        expect(data.contact[1].protocol).to.equal('https:');
        expect(data.contact[1].xpub).to.equal('{xpubkey}');
        expect(data.contact[1].index).to.equal(0);
        expect(data.contact[1].agent).to.equal('orc-test/linux');
        done();
      });
    });
  });

});
