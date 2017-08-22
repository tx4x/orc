'use strict';

const orc = require('..');
const { app, BrowserWindow, ipcMain } = require('electron');

let mainWindow;


function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false
  });

  mainWindow.loadURL(`file://${__dirname}/index.html`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
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

// Start orcd and setup IPC communication
const opts = {};
const { orcd: child, controller } = orc(opts);

// The orcd controller is ready
controller.on('ready', () => {

});

// Handle errors from controller
controller.on('error', (err) => {

});

// Send live logs from child process to renderer
orcd.stdout.on('data', (data) => {
  let lines = data.split('\n');

  lines.forEach((line) => {
    try {
      line = JSON.parse(line);
    } catch (err) {
      return err;
    }

    if (mainWindow) {
      mainWindow.webContents.send('log', line);
    }
  });
});
