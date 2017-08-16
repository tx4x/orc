'use strict';

const Database = require('../../lib/database');


module.exports = function(callback) {
  module.exports._database.connection.close(() => {
    module.exports._database = new Database('mongodb://localhost/__orc-test');

    module.exports._database.on('open', () => {
      module.exports._database.removeAllListeners('error');
      module.exports._database.connection.dropDatabase((err) => {
        callback(err, module.exports._database);
      });
    });
    module.exports._database.on('error', callback);
  });
};

module.exports._database = {
  connection: { close: (cb) => cb() }
};
