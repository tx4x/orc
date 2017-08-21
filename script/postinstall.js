'use strict';

const options = require('../bin/config');
const config = require('rc')('orc', options);
const { MongodHelper } = require('mongodb-prebuilt');
const mongod = new MongodHelper(
  ['--port', config.MongoDBPort, '--dbpath', config.MongoDBDataDirectory]
);

console.info('Installing MongoDB...');
mongod.run().then(
  () => {
    console.info('MongoDB Installed!');
    process.exit(0);
  },
  (err) => {
    console.error('Error!', err);
    process.exit(1);
  }
);
