'use strict';

const config = require('../bin/config');
const net = require('net');
const { ipcRenderer } = require('electron');
const Vue = require('vue/dist/vue.common');


const app = new Vue({
  el: '#app',
  data: {
    isInitializing: true,
    logStack: [{ time: Date.now(), msg: 'starting orc daemon' }]
  },
  created: function() {
    // First check if the bridge is running already (the page was reloaded)
    net.connect(parseInt(config.BridgePort))
      .once('connect', () => this.isInitializing = false);

    // Keep a buffer of logs from the daemon and when we see the bridge is
    // established, we can safely proceed to do everything else
    ipcRenderer.on('log', (e, data) => {
      this.logStack.unshift(data);

      if (this.logStack.length > 50) {
        this.logStack.pop();
      }

      if (data.msg.includes('establishing local bridge')) {
        this.isInitializing = false;
      }
    });
  }
});
