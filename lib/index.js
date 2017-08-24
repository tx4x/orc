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
  /* eslint max-statements: [2, 20] */
  const defaults = require('../bin/config');
  const cport = config.ControlPort || defaults.ControlPort;
  const caddr = config.ControlHostname || defaults.ControlHostname;
  const controller = new module.exports.control.Client();

  let envs = {};
  let file = join(__dirname, '../bin/orcd.js');
  let args = [];
  let trys = 10;
  let opts = {
    env: envs,
    execPath: process.execPath,
    stdio: ['pipe', 'pipe', 'pipe', 'ipc']
  };

  if (typeof config === 'string') {
    args = args.concat(['--config', config]);
  } else {
    for (let prop in config) {
      envs[`orc_${prop}`] = config[prop];
    }
  }

  const child = fork(file, args, opts);

  function connect() {
    controller.once('error', () => {
      controller.removeAllListeners();
      if (trys !== 0) {
        trys--;
        setTimeout(connect, 1000);
      }
    });
    controller.on('ready', () => controller.removeAllListeners('error'));
    controller.connect(cport, caddr);
  }

  process.on('exit', () => child.kill());
  child.stdout.once('data', () => setTimeout(() => connect(), 1000));
  child.stderr.once('data', (msg) => child.emit('error', new Error(msg)));

  return { child, controller };
};

/** {@link Node} */
module.exports.Node = require('./node');

/** {@link Rules} */
module.exports.Rules = require('./rules');

/** {@link Transport} */
module.exports.Transport = require('./transport');

/** {@link Server} */
module.exports.Server = require('./server');

/** {@link Audit} */
module.exports.Audit = require('./audit');

/** {@link Proof} */
module.exports.Proof = require('./proof');

/** {@link Shards} */
module.exports.Shards = require('./shards');

/** {@link Bridge} */
module.exports.Bridge = require('./bridge');

/** {@link Directory} */
module.exports.Directory = require('./directory');

/** {@link Database} */
module.exports.Database = require('./database');

/** {@link module:orc/constants} */
module.exports.constants = require('./constants');

/** {@link module:orc/utils} */
module.exports.utils = require('./utils');

/** {@link module:orc/version} */
module.exports.version = require('./version');

/** @see https://github.com/bookchin/boscar */
module.exports.control = require('boscar');
