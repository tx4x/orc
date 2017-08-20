'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const cors = require('cors');
const ms = require('ms');
const async = require('async');
const merge = require('merge');
const url = require('url');


/**
 * Serves a single endpoint for retreiving network statistics
 */
class Directory {

  /**
   * @constructor
   * @param {Node} node
   * @param {object} options
   * @param {boolean} options.enableSSL - Use SSL
   * @param {string} options.serviceKeyPath - Path to PEM private key
   * @param {string} options.certificatePath - Path to PEM certificate
   * @param {string[]} options.authorityChains - Path to PEM CA certificates
   * @param {string} options.bootstrapService - Address to bootstrap profiles
   */
  constructor(node, options) {
    this.node = node;
    this.database = this.node.database;
    this._bootstrapService = options.bootstrapService;

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
   * Bootstraps the peer profiles
   * @param {function} callback
   */
  bootstrap(callback) {
    let opts = merge(url.parse(this._bootstrapService), {
      agent: this.node.onion.createSecureAgent()
    });
    let proto = opts.protocol === 'https:' ? https : http;

    proto.get(opts, (res) => {
      let body = '';

      res.on('data', (d) => body += d.toString()).on('end', () => {
        try {
          body = JSON.parse(body);
        } catch (err) {
          /* istanbul ignore next */
          return callback('Failed to parse directory payload');
        }

        async.eachSeries(body, (profile, next) => {
          this.database.PeerProfile.findOneAndUpdate(
            { identity: profile.identity },
            profile,
            { upsert: true },
            next
          );
        }, callback);
      }).on('error', callback);
    }).on('error', callback);
  }

  /**
   * @private
   */
  _handleRequest(req, res) {
    let now = Date.now();

    cors()(req, res, () => {
      this.database.PeerProfile.find({
        $or: [
          { 'capacity.timestamp': { $gt: now - ms('24HR') } },
          { updated: { $gt: now - ms('24HR') } }
        ]
      }, [], {
        sort: { 'capacity.timestamp': -1 }
      }, (err, results) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(results.map((r) => r.toObject())));
      });
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
