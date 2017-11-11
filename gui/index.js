'use strict';


// NB: Only launch if we are not performing installation on Windows platform
if (!require('electron-squirrel-startup')) {
  require('./main');
}
