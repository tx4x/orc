'use strict';

const config = require('rc')('orc', require('../bin/config'));
const path = require('path');
const { homedir } = require('os');
const orc = require('../lib');

const {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  Tray,
  dialog
} = require('electron');

const enableLiveReload = require('electron-compile').enableLiveReload;
const isDevMode = process.execPath.match(/[\\/]electron/);
const mongodb = require('mongodb-bin-wrapper');
const mongodargs = [
  '--port', config.MongoDBPort,
  '--dbpath', config.MongoDBDataDirectory
];


let mainWindow, tray;


function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'ORC',
    width: 800,
    height: 600,
    show: false,
    icon: path.join(__dirname, 'assets/logo-app-icon.png')
  });

  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    tray = new Tray(path.join(__dirname, 'assets/logo-white.png'));
    tray.setToolTip('ORC');
    tray.on('click', () => mainWindow.show());
    tray.setContextMenu(Menu.buildFromTemplate([
      {
        label: 'Show ORC',
        type: 'normal',
        click: () => mainWindow.show()
      },
      {
        label: 'Quit ORC',
        type: 'normal',
        click: () => {
          app.isQuitting = true;
          app.quit();
        }
      }
    ]));
  }

  mainWindow.loadURL(`file://${__dirname}/index.html`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('minimize', (event) => {
    event.preventDefault();
    mainWindow.hide();
  });

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }

    return false;
  });

  Menu.setApplicationMenu(require('./menu'));
};

function init() {
  // Start orcd and setup IPC communication
  const { child: orcd, controller } = orc(
    path.join(homedir(), '.config/orc/config')
  );

  // The orcd controller is ready
  controller.on('ready', () => {
    // Do really low level stuff here - probably not needed for most use cases
  });

  // Handle errors from controller
  controller.on('error', (err) => {

  });

  // Handle process errors
  orcd.on('error', (err) => {

  });

  // Handle orcd crashes
  orcd.on('exit', (code, signal) => {
    if (code === 0 && signal === 'SIGTERM') {
      return;
    }

    dialog.showMessageBox(mainWindow, {
      type: 'error',
      buttons: ['Exit ORC'],
      title: 'Whoops!',
      message: 'The ORC daemon process exit unexpectedly!'
    }, () => {
      app.isQuitting = true;
      app.quit();
    });
  });

  orcd.stdout.pipe(process.stdout);
  orcd.stderr.pipe(process.stderr);

  app.on('will-quit', () => {
    process.kill(orcd.pid, 'SIGTERM');
  });

  const updateLogs = (data) => {
    let lines = data.toString().split('\n');

    lines.filter((l) => !!l).forEach((l) => {
      if (!l) {
        return;
      }

      try {
        l = JSON.parse(l);
      } catch (err) {
        // NB: The only things that should log non-json are first-run dep
        // NB: installation or errors so we can show a message that gives
        // NB: updates if the former, and just print the latter
        if (mainWindow) {
          mainWindow.webContents.send('err', {
            msg: data.toString(),
            time: Date.now()
          });
        }

        return;
      }

      if (mainWindow) {
        mainWindow.webContents.send('log', l);
      }
    });
  };

  // Send live logs from child process to renderer
  orcd.stdout.on('data', (data) => updateLogs(data));
  orcd.stderr.on('data', (data) => updateLogs(data));
}

if (require('electron-squirrel-startup')) {
  app.quit();
} else {
  init();
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  createWindow();
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {

});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  } else {
    mainWindow.show();
  }
});
