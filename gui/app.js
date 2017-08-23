'use strict';

const { ipcRenderer } = require('electron');
const Vue = require('vue/dist/vue.common');


const app = new Vue({
  el: '#app',
  data: {
    isInitializing: true,
    logStack: [{ time: Date.now(), msg: 'starting orc daemon' }]
  },
  created: function() {
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
