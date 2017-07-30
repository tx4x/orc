'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const cors = require('cors');
const ms = require('ms');


/**
 * Serves a single endpoint for retreiving network statistics
 */
class Directory {

  /**
   * @constructor
   * @param {Node} node
   * @param {object} options
   * @param {object} options.capacityCache - Capacity cache object
   * @param {boolean} options.enableSSL - Use SSL
   * @param {string} options.serviceKeyPath - Path to PEM private key
   * @param {string} options.certificatePath - Path to PEM certificate
   * @param {string[]} options.authorityChains - Path to PEM CA certificates
   */
  constructor(node, options) {
    this.node = node;
    this.capacity = options.capacityCache;

    /* istanbul ignore if */
    if (options.enableSSL) {
      this.server = https.createServer({
        key: fs.readFileSync(options.serviceKeyPath),
        cert: fs.readFileSync(options.certificatePath),
        ca: options.authorityChains
          ? options.authorityChains.map(fs.readFileSync)
          : []
      }, (req, res) => this._handleRequest(req, res));
    } else {
      this.server = http.createServer(
        (req, res) => this._handleRequest(req, res)
      );
    }
  }

  /**
   * @private
   */
  _handleRequest(req, res) {
    let now = Date.now();
    let written = 0;
    let results = [];

    cors()(req, res, () => {
      res.setHeader('Content-Type', 'application/json');
      res.write('[');

      this.capacity.each((obj) => {
        results.push(obj);
      }, () => {
        results = results.filter(r => {
          return r.timestamp > (now - ms('24H')) &&
            typeof r.contact === 'object';
        });
        results.sort((a, b) => b.timestamp - a.timestamp);
        results.forEach((obj) => {
          delete obj._key;
          res.write((written === 0 ? '' : ',') + JSON.stringify(obj));
          written++;
        });
        res.write(']');
        res.end();
      }, true);
    });
  }

  /**
   * Start the server on the supplied port and hostname
   * @param {number} port
   * @param {string} hostname
   * @param {function} callback
   */
  listen() {
    this.server.listen(...arguments);
  }

}

module.exports = Directory;
