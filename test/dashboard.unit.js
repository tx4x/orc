'use strict';

const { expect } = require('chai');
const Dashboard = require('../lib/dashboard');
const http = require('http');
const fs = require('fs');
const path = require('path');


describe('@class Dashboard', function() {

  let dashboard;

  before((done) => {
    dashboard = new Dashboard({});
    dashboard.listen(0, done);
  });

  it('should respond with the gui index', function(done) {
    let { port } = dashboard.server.address();
    http.get(`http://localhost:${port}`, (res) => {
      let data = '';
      res.on('data', (d) => data += d.toString());
      res.on('end', () => {
        expect(
          fs.readFileSync(path.join(__dirname, '../gui/index.html')).toString()
        ).to.equal(data);
        done();
      });
    });
  });

});
