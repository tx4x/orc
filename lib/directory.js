'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const cors = require('cors');
const ms = require('ms');
const async = require('async');
const merge = require('merge');
const url = require('url');
const express = require('express');


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
    this.bootstrapService = options.bootstrapService;
    this.app = express();

    this.app.use(cors());
    this.app.get('/', this._handleGetProfiles.bind(this));
    this.app.post('/', this._handleUpdateProfiles.bind(this));

    /* istanbul ignore if */
    if (options.enableSSL) {
      this.server = https.createServer({
        key: fs.readFileSync(options.serviceKeyPath),
        cert: fs.readFileSync(options.certificatePath),
        ca: options.authorityChains
          ? options.authorityChains.map(fs.readFileSync)
          : []
      }, this.app);
    } else {
      this.server = http.createServer(this.app);
    }
  }

  /**
   * Bootstraps the peer profiles
   * @param {function} callback
   */
  bootstrap(callback) {
    let opts = merge(url.parse(this.bootstrapService), {
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
  _handleGetProfiles(req, res) {
    let now = Date.now();

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
  }

  /**
   * @private
   */
  _handleUpdateProfiles(req, res, next) {
    let body = Buffer.from([]);

    req.on('data', (data) => body = Buffer.concat([body, data]));
    req.on('error', next);
    req.on('end', () => {
      let reports;

      try {
        reports = JSON.parse(body);
      } catch (err) {
        return next(err);
      }

      reports = reports
        .filter((compressed) => {
          return this.database.AuditReport
            .verifyCompressedAuthenticated(compressed);
        })
        .map(([reporter, provider, challenge, expected, actual]) => {
          return new this.database.AuditReport({
            reporter, provider, challenge, expected, actual
          });
        });

      async.eachLimit(
        reports,
        6,
        (report, next) => report.save(next),
        (err) => {
          if (err) {
            return next(err);
          }

          res.status(200).end();
        }
      );
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

  /**
   * Takes all audit reports and reaps them while applying their results to
   * local peer profile reputation score, then publishes the compressed
   * payload to the bootstrap directory
   * @param {function} callback
   */
  scoreAndPublishAuditReports(callback = () => null) {
    const payload = [];
    const cursor = this.database.AuditReport.find({}).cursor();

    cursor.on('data', (report) => {
      const { reporter, provider } = report;

      cursor.pause();

      payload.push(report.toCompressedAuthenticated(
        this.node.spartacus.privateKey
      ));

      async.waterfall([
        (next) => this.database.PeerProfile.findOne({
          identity: reporter
        }, (err, reporter) => next(err, reporter)),
        (reporter, next) => this.database.PeerProfile.findOne({
          identity: provider
        }, (err, provider) => next(err, reporter, provider)),
        (reporter, provider, next) => {
          this._applyScore(reporter, provider, report, next);
        }
      ], () => cursor.resume());
    });

    cursor.on('error', callback).on('end', () => {
      let opts = merge(url.parse(this._bootstrapService), {
        agent: this.node.onion.createSecureAgent(),
        method: 'POST'
      });
      let proto = opts.protocol === 'https:' ? https : http;
      let request = proto.request(opts, (res) => {
        res.on('error', callback).resume();
        this.database.AuditReport.remove(callback);
      }).on('error', callback);

      request.end(JSON.stringify(payload));
    });
  }

  /**
   * @private
   */
  _applyScore(reporterProfile, providerProfile, auditReport, callback) {
    // NB: Reporter loses 1 per report
    reporterProfile.reputation.score--;

    // NB: Reporter gains 1 per positive report
    if (auditReport.expected === auditReport.actual) {
      reporterProfile.reputation.score++;
    }

    // TODO: Check report history
    // TODO: +6 if last 10 consecutive intervals reported
    // TODO: -3 if last 2 consecutive intervals missed

    async.parallel([
      // NB: Reporter gains 1 if another peer reports the same outcome
      (done) => {
        this.database.AuditReport.findOne({
          provider: auditReport.provider,
          reporter: { $not: auditReport.reporter }
        }, (err, corroboratedReport) => {
          if (err || !corroboratedReport) {
            return done();
          }

          if (auditReport.outcome === corroboratedReport.outcome) {
            reporterProfile.reputation.score++;
          }

          done();
        });
      },
      // NB: Reporter gains 1 if the provider reported on them too
      (done) => {
        this.database.AuditReport.findOne({
          reporter: auditReport.provider,
          provider: auditReport.reporter
        }, (err, mutualReport) => {
          if (mutualReport) {
            reporterProfile.reputation.score++;
          }

          done();
        });
      }
    ], () => {
      reporterProfile.save(() => providerProfile.save(() => callback()))
    });
  }

}

module.exports = Directory;
