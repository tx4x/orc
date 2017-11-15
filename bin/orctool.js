'use strict';

const pem = require('pem');
const { utils: keyutils } = require('kad-spartacus');
const orc = require('../lib');
const options = require('./config');
const program = require('commander');
const path = require('path');
const os = require('os');


if (process.platform === 'win32') {
  process.env.OPENSSL_CONF = path.join(
    __dirname, '../vendor', 'openssl-win32', 'shared', 'openssl.cnf'
  );
  pem.config({
    pathOpenSSL: path.join(
      __dirname, '../vendor', 'openssl-win32',
      os.arch() === 'x64' ? 'x64' : 'ia32',
      'openssl'
    )
  });
} else if (process.platform === 'darwin') {
  process.env.OPENSSL_CONF = path.join(
    __dirname, '../vendor', 'openssl-darwin', 'openssl.cnf'
  );
  pem.config({
    pathOpenSSL: path.join(
      __dirname, '../vendor', 'openssl-darwin', 'bin', 'openssl'
    )
  });
} else {
  process.env.OPENSSL_CONF = path.join(
    __dirname, '../vendor', 'openssl-linux', 'openssl.cnf'
  );
  pem.config({
    pathOpenSSL: path.join(
      __dirname, '../vendor', 'openssl-linux', 'bin', 'openssl'
    )
  });
}

program.version(`
  orctool  ${orc.version.software}
  protocol ${orc.version.protocol}
`);

program.description(`
  Copyright (c) 2017 Gordon Hall
  Licensed under the GNU Affero General Public License Version 3
`);

function generateKey(opts) {
  if (opts.convert) {
    return keyutils.toExtendedFromPrivateKey(
      Buffer.from(opts.convert, 'hex')
    );
  } else {
    return keyutils.toHDKeyFromSeed(
      typeof opts.extended === 'string'
        ? Buffer.from(opts.extended, 'hex')
        : undefined
    ).privateExtendedKey;
  }
}

program
  .command('generate-key')
  .description('generate a private extended node identity key')
  .option('-x, --extended [hex_seed]', 'generate private extended key', true)
  .option('--convert <hex_secp256k1>', 'generate private extended key')
  .action(function(env) {
    console.info(generateKey(env));
    process.exit();
  });

function generateCert(opts, cb) {
  pem.createCertificate({
    selfSigned: true,
    days: parseInt(opts.days || 365)
  }, cb);
}

program
  .command('generate-cert')
  .description('generate a new self-signed certificate and key')
  .option('-d, --days <days_valid>', 'number of days certificate is valid')
  .action(function(env) {
    generateCert(env, (err, data) => {
      if (err) {
        console.error(`\n  ${err.message}\n`);
      } else {
        console.info(`${data.serviceKey}\r\n\r\n${data.certificate}`);
      }
      process.exit();
    });
  });

function generateOnion(cb) {
  pem.createPrivateKey(1024, cb);
}

program
  .command('generate-onion')
  .description('generate a new onion hidden service RSA1024 private key')
  .action(function() {
    generateOnion((err, data) => {
      if (err) {
        console.error(`\n ${err.message}`);
      } else {
        console.info(data.key);
      }
      process.exit();
    });
  });

program
  .command('list-config-options')
  .description('print all valid configuration option names')
  .action(function() {
    for (let prop in options) {
      console.info(prop);
    }
    process.exit();
  });

program.command('*').action(() => program.help());

let isRequiredModule = module.parent &&
                       !(module.parent.filename &&
                        module.parent.filename.includes('_orctool'));

if (isRequiredModule) {
  module.exports = { generateKey, generateCert, generateOnion };
} else {
  program.parse(process.argv);

  if (process.argv.length < 3) {
    program.help();
  }
}

