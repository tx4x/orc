/**
 * @module orc
 * @license AGPL-3.0
 */

'use strict';

const { fork } = require('child_process');
const { join } = require('path');


/**
 * Forks a child orc process and returns the child process and a controller
 * client for sending commands to it
 * @function
 * @param {object|string} config - Configuration properties as object or path
 * to a configuration file. See {@tutorial config} for details.
 * connect to the control port
 * @returns {object}
 */
/* istanbul ignore next */
module.exports = function(config = {}) {
  let envs = {};
  let file = join(__dirname, './bin/orcd.js');
  let args = [];
  let opts = {
    env: envs,
    execPath: process.execPath,
    stdio: ['pipe', 'pipe', 'pipe', 'ipc']
  };

  if (typeof config === 'string') {
    args = args.concat(['--config', config]);
  } else {
    for (let prop in config) {
      envs[`orcd_${prop}`] = config[prop];
    }
  }

  return fork(file, args, opts);
};

/** {@link Node} */
module.exports.Node = require('./lib/node');

/** {@link Rules} */
module.exports.Rules = require('./lib/rules');

/** {@link Transport} */
module.exports.Transport = require('./lib/transport');

/** {@link Server} */
module.exports.Server = require('./lib/server');

/** {@link Audit} */
module.exports.Audit = require('./lib/audit');

/** {@link Proof} */
module.exports.Proof = require('./lib/proof');

/** {@link Shards} */
module.exports.Shards = require('./lib/shards');

/** {@link Bridge} */
module.exports.Bridge = require('./lib/bridge');

/** {@link Database} */
module.exports.Database = require('./lib/database');

/** {@link module:orc/constants} */
module.exports.constants = require('./lib/constants');

/** {@link module:orc/utils} */
module.exports.utils = require('./lib/utils');

/** {@link module:orc/version} */
module.exports.version = require('./lib/version');
