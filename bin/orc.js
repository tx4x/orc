#!/usr/bin/env node

'use strict';

const orc = require('../index');
const options = require('./config');
const program = require('commander');


program.version(`
  orc      ${orc.version.software}
  protocol ${orc.version.protocol}
`);

program.description(`
  Copyright (c) 2017 Counterpoint Hackerspace, Ltd
  Copyright (c) 2017 Gordon Hall
  Licensed under the GNU Affero General Public License Version 3
`);

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
program.parse(process.argv);

if (process.argv.length < 3) {
  program.help();
}
