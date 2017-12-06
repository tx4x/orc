'use strict';

const url = require('url');
const merge = require('merge');
const connect = require('connect');
const { HTTPTransport } = require('kad');
const { Agent } = require('http');


/**
 * Represents the ORC-specific HTTP transport
 */
class Transport extends HTTPTransport {

  /**
   * Emitted when a download request is received
   * @event Transport#download
   * @param {object} request
   * @param {object} response
   */

  /**
   * Emitted when a upload request is received
   * @event Transport#upload
   * @param {object} request
   * @param {object} response
   */

  /**
   * Contructs a Orc transport adapter
   * @constructor
   */
  constructor(options) {
    super(options);
  }

  /**
   * Make sure we explicity set the keepAlive options on requests
   * @private
   */
  _createRequest(options) {
    const request = super._createRequest(merge({
      agent: new Agent({ keepAlive: true, keepAliveMsecs: 25000 }),
      path: '/rpc/'
    }, options));
    request.setNoDelay(true);
    return request;
  }

  /**
   * Disable nagle algorithm on connections
   * @private
   */
  _createServer(options) {
    const server = super._createServer(options);
    server.on('connection', (sock) => sock.setNoDelay(true));
    return server;
  }

  /**
   * Handles requests by sending through middleware stack
   * @private
   */
  _handle() {
    const middleware = connect();
    middleware.use(Transport.CORS);
    middleware.use('/', (req, res, next) => {
      return req.url !== '/' ? next() : this.emit('identify', req, res);
    });
    middleware.use('/rpc/', super._handle.bind(this));
    middleware.use('/shards/', this._shards.bind(this));
    middleware(...arguments);
  }

  /**
   * Handle routing request to shard server
   * @private
   */
  _shards(req, res) {
    const urlobj = url.parse(req.originalUrl, true);
    const [, hash] = urlobj.pathname.split('/shards/');

    req.query = urlobj.query;
    req.params = { hash };

    if (req.method === 'POST') {
      this.emit('upload', req, res);
    } else if (req.method === 'GET') {
      this.emit('download', req, res);
    } else {
      res.statusCode = 405;
      res.end();
    }
  }

  /**
   * Applies cross origin headers to responses
   * @static
   * @memberof Transport
   * @private
   */
  static get CORS() {
    return function(req, res, next) {
      res.setHeader('access-control-allow-origin', '*');
      res.setHeader('access-control-allow-methods', '*');
      res.setHeader('access-control-allow-headers', '*');

      if (req.method === 'OPTIONS') {
        res.statusCode = 200;
        res.end();
      } else {
        next();
      }
    }
  }

}

module.exports = Transport;
