'use strict';

const http = require('http');
const serveStatic = require('serve-static');
const finalhandler = require('finalhandler');

class Dashboard {
  constructor(options) {
    this.logger = options.logger;
    this.app(options.port);
  }

  app(port) {
    const self = this;
    const serve = serveStatic('../gui/');
    const server = http.createServer(function(req, res) {
      serve(req, res, finalhandler(req, res));
    });

    server.listen(port, function() {
      self.logger.info(`orc gui being served on ${port}`);
    });
  }

  error(err, req, res, next) {
    if (!err) {
      return next();
    }

    this.logger.warn(`error in gui: ${err}`);

    res.writeHead(err.code || 500);
    res.write(err.message);
    res.end();
  }

  authenticate(req, res, next) {
    return next();
  }
}


module.exports = Dashboard;
