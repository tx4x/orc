'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const serveStatic = require('serve-static');
const finalhandler = require('finalhandler');


/**
 * Creates and serves a web application frontend for managing an ORC node
 */
class Dashboard {

  /**
   * @constructor
   * @param {object} options
   * @param {object} options.logger
   * @param {boolean} options.enableSSL - Use SSL
   * @param {string} options.serviceKeyPath - Path to PEM private key
   * @param {string} options.certificatePath - Path to PEM certificate
   * @param {string[]} options.authorityChains - Path to PEM CA certificates
   */
  constructor(options) {
    this.options = options;
    this.logger = options.logger;
    this.server = this._createServer();
  }

  /**
   * @private
   */
  _createServer() {
    let server = null;
    let handler = serveStatic(path.join(__dirname, '../gui'));

    /* istanbul ignore if */
    if (this.options.enableSSL) {
      server = https.createServer({
        key: fs.readFileSync(this.options.serviceKeyPath),
        cert: fs.readFileSync(this.options.certificatePath),
        ca: this.options.authorityChains
          ? this.options.authorityChains.map(fs.readFileSync)
          : []
      }, (req, res) => handler(req, res, finalhandler(req, res)));
    } else {
      server = http.createServer((req, res) => {
        handler(req, res, finalhandler(req, res));
      });
    }

    return server;
  }

  /**
   * Start the server on the supplied port
   * @param {number} port
   * @param {string} hostname
   * @param {function} callback
   */
  listen() {
    this.server.listen(...arguments);
  }

}


module.exports = Dashboard;
