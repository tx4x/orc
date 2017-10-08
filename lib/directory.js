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
    this.app.get('/', this._handleGetOnlineProfiles.bind(this));
    this.app.get('/:identity', this._handleGetProfile.bind(this));

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
   * Calculates the percentile and relative usage allowance of the given identity
   * @param {string} identity - 160 bit node identity key
   * @param {Directory~getPeerReputationScoreCallback} callback
   */
  getPeerReputationScore(identity, callback) {
    callback(new Error('Not implemented'));
    // TODO: Get the peer profile for the identity
    // TODO: Get the peer profile with the highest score
    // TODO: Sum all of the available capacity we know of
    // TODO: Calculate the percentile of peer (target.reputation.score / highest.reputation.score)
    // TODO: Get number of peers less than and greater than target.reputation.score
    // TODO: If percentile is > 0.2 and < 0.5
    // TODO:   20% of total available divided by number of peers in percentile range
    // TODO: If percentile is < 0.2
    // TODO:   5% of total available divided by number of peers in percentile range
    // TODO: If percentile is > 0.5
    // TODO:   75% of total available divided by number of peers in percentile range
  }
  /**
   * @callback Directory~getPeerReputationScoreCallback
   * @param {object|null} error
   * @param {object} result
   * @param {number} result.score - Numberical repuation score
   * @param {number} result.percentile - Percent of scores identity exceeds
   * @param {number} result.allowance - Bytes identity is allowed to claim
   */

  /**
   * Get the peer with the highest reputation score
   * @param {Directory~getHighestScoringPeerCallback} callback
   */
  getHighestScoringPeer(callback) {
    this.database.PeerProfile
      .find({})
      .sort({ 'reputation.score': -1 })
      .exec((err, results) => {
        if (err) {
          return callback(err);
        }

        if (!results.length) {
          return callback(new Error('Failed to load peer profile'));
        }

        callback(null, results[0]);
      });
  }
  /**
   * @callback Directory~getHighestScoringPeerCallback
   * @param {object|null} error
   * @param {Database.PeerProfile} profile
   */

  /**
   * @private
   */
  _handleGetOnlineProfiles(req, res, next) {
    let now = Date.now();

    this.database.PeerProfile.find({
      $or: [
        { 'capacity.timestamp': { $gt: now - ms('24HR') } },
        { updated: { $gt: now - ms('24HR') } }
      ]
    }, [], {
      sort: { 'capacity.timestamp': -1 }
    }, (err, results) => {
      /* istanbul ignore if */
      if (err) {
        return next(err);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(results.map((r) => r.toObject())));
    });
  }

  /**
   * @private
   */
  _handleGetProfile(req, res, next) {
    this.database.PeerProfile.findOne({
      identity: req.params.identity
    }, (err, profile) => {
      /* istanbul ignore if */
      if (err) {
        return next(err);
      }

      if (!profile) {
        res.writeHead(404);
        res.end('Profile not known');
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(profile.toObject()));
      }
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
    const profiles = new Set();

    const cursor = this.database.AuditReport.find({}).cursor();
    const worker = (report, done) => {
      const { reporter, provider } = report;

      payload.push(report.toCompressedAuthenticated(
        this.node.spartacus.privateKey
      ));

      this.database.PeerProfile.count({
        identity: { $in: [reporter, provider] }
      }, (err, count) => {
        /* istanbul ignore if */
        if (count !== 2) {
          this.node.logger.warn(
            'skipping score application for unknown peer(s)'
          );
          return done();
        }

        profiles.add(reporter);
        profiles.add(provider);

        this._applyScore(report, () => done());
      });
    };
    const queue = async.queue(worker, 1);

    queue.drain = () => {
      this.node.reportAuditResults(payload, (err) => {
        /* istanbul ignore if */
        if (err) {
          this.node.logger.warn(err.message);
        }

        async.series([
          // NB: Keep track of reporting streaks
          (done) => {
            this.database.PeerProfile.update({
              identity: { $in: [...profiles] }
            }, {
              $inc: { '_reports.streak': 1 },
              $set: { '_reports.missed': 0 }
            }, done);
          },
          // NB: Keep track of missed reports
          (done) => {
            this.database.PeerProfile.update({
              identity: { $not: { $in: [...profiles] } }
            }, {
              $set: { '_reports.streak': 0 },
              $inc: { '_reports.missed': 1 }
            }, done);
          },
          // NB: Apply reward for 10+ streak
          (done) => {
            this.database.PeerProfile.update({
              '_reports.streak': { $gte: 10 }
            }, {
              $inc: { 'reputation.score': 6 }
            }, done);
          },
          // NB: Apply penalty for 2+ missed
          (done) => {
            this.database.PeerProfile.update({
              '_reports.missed': { $gt: 2 },
            }, {
              $inc: { 'reputation.score': -3 }
            }, done);
          },
          // NB: Rebalance any negative scores
          (done) => {
            this.database.PeerProfile.update({
              'reputation.score': { $lt: 0 }
            }, {
              $set: { 'reputation.score': 0 }
            }, done);
          },
          // NB: Clean up all consumed reports
          (done) => {
            this.database.AuditReport.remove({}, done);
          }
        ], callback);
      });
    };

    cursor.on('data', (report) => queue.push(report)).on('error', callback);
  }

  /**
   * @private
   */
  _applyScore(auditReport, callback) {
    async.series([
      // NB: Reporter loses 1 per report
      (done) => {
        this.database.PeerProfile.findOneAndUpdate({
          identity: auditReport.reporter
        }, {
          $inc: { 'reputation.score': -1 }
        }, done);
      },
      // NB: Reporter gains 1 per positive report
      (done) => {
        if (auditReport.expected === auditReport.actual) {
          this.database.PeerProfile.findOneAndUpdate({
            identity: auditReport.reporter
          }, {
            $inc: { 'reputation.score': 1 }
          }, done);
        } else {
          done();
        }
      },
      // NB: Reporter gains 1 if another peer reports the same outcome
      (done) => {
        this.database.AuditReport.findOne({
          provider: auditReport.provider,
          reporter: { $not: { $eq: auditReport.reporter } }
        }, (err, corroboratedReport) => {
          if (err || !corroboratedReport) {
            done();
          } else if (auditReport.outcome === corroboratedReport.outcome) {
            this.database.PeerProfile.findOneAndUpdate({
              identity: auditReport.reporter
            }, {
              $inc: { 'reputation.score': 1 }
            }, done);
          } else {
            done();
          }
        });
      },
      // NB: Reporter gains 1 if the provider reported on them too
      (done) => {
        this.database.AuditReport.findOne({
          reporter: auditReport.provider,
          provider: auditReport.reporter
        }, (err, mutualReport) => {
          if (mutualReport) {
            this.database.PeerProfile.findOneAndUpdate({
              identity: auditReport.reporter
            }, {
              $inc: { 'reputation.score': 1 }
            }, done);
          } else {
            done();
          }
        });
      }
    ], () => callback());
  }

}

module.exports = Directory;
