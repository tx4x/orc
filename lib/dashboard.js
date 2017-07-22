'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const stream = require('stream');
const ws = require('ws');
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
   * @param {object} options.control
   * @param {boolean} options.enableSSL - Use SSL
   * @param {string} options.serviceKeyPath - Path to PEM private key
   * @param {string} options.certificatePath - Path to PEM certificate
   * @param {string[]} options.authorityChains - Path to PEM CA certificates
   */
  constructor(options) {
    this.opts = options;
    this.logger = options.logger;
    this.control = options.control;
    this.server = this._createServer();
    this.wss = new ws.Server({ server: this.server });
  }

  /**
   * @private
   */
  _createServer() {
    let server = null;
    let handler = serveStatic(path.join(__dirname, '../gui'));

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
    this.wss.on('connection', (sock) => {
      let client = new stream.Duplex({
        read: () => null,
        write: (data, enc, cb) => sock.send(data, cb)
      });
      this.control.client(client);
      sock.on('message', (data) => client.push(data));
      sock.on('error', (err) => client.emit('error', err));
      sock.on('close', () => client.emit('close'));
    });
  }

}


module.exports = Dashboard;
