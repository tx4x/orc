'use strict';

const path = require('path');
const { homedir } = require('os');
const orc = require('../index');
const { app, BrowserWindow, ipcMain, Menu } = require('electron');

let mainWindow;


function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    icon: 'assets/logo-app-icon.png'
  });

  mainWindow.loadURL(`file://${__dirname}/index.html`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  Menu.setApplicationMenu(require('./menu'));
};

// Start orcd and setup IPC communication
const opts = { MongoDBPort: 47017 };
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

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    orcd.kill('SIGTERM');
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});
const updateLogs = (data) => {
  let lines = data.toString().split('\n');

  lines.filter((l) => !!l).forEach((line) => {
    try {
      line = JSON.parse(line);
    } catch (err) {
      return err;
    }

    if (mainWindow) {
      mainWindow.webContents.send('log', line);
    }
  });
};

// Send live logs from child process to renderer
orcd.stdout.on('data', (data) => updateLogs(data));
orcd.stderr.on('data', (data) => updateLogs(data));
