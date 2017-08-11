'use strict';

const { tmpdir } = require('os');
const path = require('path');
const { randomBytes } = require('crypto');
const { expect } = require('chai');
const Directory = require('../lib/directory');
const http = require('http');


describe('@class Directory', function() {

  let directory;

  before((done) => {
    directory = new Directory({}, {});
    directory.listen(0);
    done();
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
