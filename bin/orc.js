'use strict';

const path = require('path');


require('electron-forge/dist/api/start').default({
  dir: path.join(__dirname, '..'),
  appPath: '.'
});
