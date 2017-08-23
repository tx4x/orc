'use strict';

const config = require('../bin/config');
const net = require('net');
const { ipcRenderer } = require('electron');
const boscar = require('boscar');
const Vue = require('vue/dist/vue.common');
const localBridgeUrl = [
  config.BridgeUseSSL === '1' ? 'https:': 'http:',
  `//${config.BridgeHostname}`,
  `:${config.BridgePort}`
].join('');
const http = config.BridgeUseSSL === '1' ? require('https') : require('http');
const controlClient = new boscar.Client();


const app = new Vue({
  el: '#app',
  data: {
    isInitializing: true,
    logStack: [{ time: Date.now(), msg: 'starting orc daemon' }],
    objectList: []
  },
  methods: {
    connectToControlPort() {
      controlClient.connect(parseInt(config.ControlPort));
    },
    getCapacityAllocation() {
      controlClient.invoke('shards.size', [], (err, data) => {
        if (err) {
          console.error(err);
        }

        this.capacity = err
          ? { available: '?', allocated: '?' }
          : data;
      });
    },
    loadObjectList(callback) {
      http.get(localBridgeUrl, (res) => {
        let body = '';

        res.on('error', console.error);
        res.on('data', (data) => body += data.toString());

        res.on('end', () => {
          if (res.statusCode > 400) {
            try {
              body = JSON.parse(body);
            } catch (err) {
              return console.error(err);
            }

            this.objectList = body;
          }
        })
      }).on('error', console.error);
    },
    downloadObject(id, path) {
      // GET /:id
    },
    uploadObject(path) {
      // POST / (multipart form upload)
    },
    destroyObject(id) {
      // DELETE /:id
    },
    insertObjectFromLink(href) {
      // PUT / (magnet in body)
    },
    getObjectMagnet(id, callback) {
      // GET /:id/magnet
    },
    onInitialized() {
      this.connectToControlPort();
      this.loadObjectList();
      this.getCapacityAllocation();

      setInterval(() => this.getCapacityAllocation(), ms('10M'));
    }
  },
  created() {
    // First check if the bridge is running already (the page was reloaded)
    let sock = net.connect(parseInt(config.BridgePort));

    sock.once('connect', () => {
      this.isInitializing = false;
      this.onInitialized();
      sock.end();
    });

    sock.once('error', () => this.isInitializing = true);

    // Keep a buffer of logs from the daemon and when we see the bridge is
    // established, we can safely proceed to do everything else
    ipcRenderer.on('log', (e, data) => {
      this.logStack.unshift(data);

      if (this.logStack.length > 50) {
        this.logStack.pop();
      }

      if (data.msg.includes('establishing local bridge')) {
        this.isInitializing = false;
        this.onInitialized();
      }
    });
  }
});
