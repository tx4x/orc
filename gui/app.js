'use strict';

const config = require('rc')('orc', require('../bin/config'));
const net = require('net');
const { ipcRenderer } = require('electron');
const boscar = require('boscar');
const Vue = require('vue/dist/vue.common');
const https = require('https');
const controlClient = new boscar.Client();
const FormData = require('form-data');
const fs = require('fs');
const mimeTypes = require('mime-types');
const path = require('path');
const ms = require('ms');


const app = new Vue({
  el: '#app',
  data: {
    isInitializing: true,
    logStack: [{ time: Date.now(), msg: 'starting orc daemon' }],
    objectList: [],
    localCapacity: { allocated: '?', available: '?' },
    capacityDirectory: []
  },
  methods: {
    // Establishes a connection to the daemon
    connectToControlPort() {
      controlClient.connect(parseInt(config.ControlPort))
        .on('error', console.error);
    },
    // Queries the daemon for what the user has configured to allocate
    // and how much space is still available
    populateCapacityAllocation() {
      controlClient.invoke('shards.size', [], (err, data) => {
        this.localCapacity = err
          ? { available: '?', allocated: '?' }
          : data;
      });
    },
    // Loads the capacity directory and populates it
    populateCapacityDirectory() {
      this.loadCapacityDirectory((err, result) => this.localCapacity = result);
    },
    // Loads the object list and populates it
    populateObjectList() {
      this.loadObjectList((err, result) => this.localCapacity = result);
    },
    // Returns a list of known nodes with available capacity within the last
    // 24 hours
    loadCapacityDirectory(callback) {
      https.request({
        method: 'GET',
        path: '/',
        hostname: config.DirectoryHostname,
        port: parseInt(config.DirectoryPort),
        rejectUnauthorized: false
      }, (res) => {
        let body = '';

        res.on('error', callback);
        res.on('data', (data) => body += data.toString());

        res.on('end', () => {
          callback(null, JSON.parse(body));
        });
      }).on('error', callback).end();
    },
    // Returns a list of stored object pointers
    loadObjectList(callback) {
      https.request({
        method: 'GET',
        auth: config.BridgeAuthenticationUser + ':' +
          config.BridgeAuthenticationPassword,
        hostname: config.BridgeHostname,
        port: parseInt(config.BridgePort),
        path: '/',
        rejectUnauthorized: false
      }, (res) => {
        let body = '';

        res.on('error', callback);
        res.on('data', (data) => body += data.toString());

        res.on('end', () => {
          callback(null, JSON.parse(body));
        });
      }).on('error', callback).end();
    },
    // Accepts an object id and instructs the daemon to retreive the shards
    // from the network, then returns a readable stream of the object
    downloadObject(id, callback) {
      const req = https.request({
        method: 'GET',
        hostname: config.BridgeHostname,
        port: parseInt(config.BridgePort),
        path: '/',
        auth: config.BridgeAuthenticationUser + ':' +
          config.BridgeAuthenticationPassword,
        rejectUnauthorized: false
      }, (res) => {
        if (res.statusCode === 200) {
          return callback(null, res);
        }

        let error = '';

        res.on('data', (d) => error += d.toString()).on('end', () => {
          callback(new Error(error));
        });
      });

      req.on('error', callback);
    },
    // Accepts a file path and access policies and uploads the object to the
    // network, returning the newly created pointer
    uploadObject(path, opts = { policies: [] }, callback) {
      const form = new FormData();
      const file = fs.createReadStream(path);
      const size = fs.statSync(path).size;
      const type = mimeType.contentType(path);

      // NB: Public data should have a '::RETRIEVE' policy
      if (opts.policies.length) {
        opts.policies.forEach((p) => form.append('policy', p));
      }

      form.append('file', file, {
        filename: path.basename(path),
        contentType: type,
        knownLength: size
      });

      form.submit({
        protocol: 'https:',
        hostname: config.BridgeHostname,
        port: parseInt(config.BridgePort),
        method: 'POST',
        path: '/',
        auth: config.BridgeAuthenticationUser + ':' +
          config.BridgeAuthenticationPassword,
        rejectUnauthorized: false
      }, (err, res) => {
        if (err) {
          return callback(err);
        }

        let body = '';

        res
          .on('error', callback)
          .on('data', (d) => body += d.toString())
          .on('end', () => {
            if (res.statusCode !== 201) {
              callback(new Error(body));
            } else {
              calback(null, JSON.parse(body));
            }
          });
      });
    },
    // Removes an object pointer from the list, marking it for reaping
    // by other nodes later
    destroyObject(id, callback) {
      https.request({
        method: 'DELETE',
        auth: config.BridgeAuthenticationUser + ':' +
          config.BridgeAuthenticationPassword,
        hostname: config.BridgeHostname,
        port: parseInt(config.BridgePort),
        path: `/${id}`,
        rejectUnauthorized: false
      }, (res) => {
        res.on('error', callback).on('end', callback).resume();
      }).on('error', callback).end();
    },
    // Instructs the daemon to resolve the magnet link and add the decrypted
    // pointer to it's local object list
    insertObjectFromLink(href, callback) {
      https.request({
        method: 'PUT',
        auth: config.BridgeAuthenticationUser + ':' +
          config.BridgeAuthenticationPassword,
        hostname: config.BridgeHostname,
        port: parseInt(config.BridgePort),
        path: '/',
        rejectUnauthorized: false
      }, (res) => {
        let data = '';

        res
          .on('error', callback)
          .on('data', (d) => body += d.toString())
          .on('end', () => {
            if (res.statusCode !== 200) {
              return callback(new Error(body));
            }

            callback(null, JSON.parse(body));
          });
      }).on('error', callback).end(href);
    },
    // Takes an object id and returns a shareable magnet link
    // The object must have been uploaded with the correct policies for other
    // users to be able to access it
    getObjectMagnet(id, callback) {
      https.request({
        method: 'GET',
        auth: config.BridgeAuthenticationUser + ':' +
          config.BridgeAuthenticationPassword,
        hostname: config.BridgeHostname,
        port: parseInt(config.BridgePort),
        path: `/${id}/magnet`,
        rejectUnauthorized: false
      }, (res) => {
        let body = '';

        res.on('error', callback);
        res.on('data', (data) => body += data.toString());
        res.on('end', () => callback(null, body));
      }).on('error', callback).end();
    },
    onInitialized() {
      // Do everything needed to render the initial interface here
      this.connectToControlPort();
      this.populateObjectList();
      this.populateCapacityDirectory();
      this.populateCapacityAllocation();

      // Periodically poll the daemon for some things we want to update
      // in the interface
      setInterval(() => this.getCapacityAllocation(), ms('15M'));
      setInterval(() => this.loadCapacityDirectory(), ms('15M'));
    }
  },
  created() {
    // First check if the bridge is running already (the page was reloaded)
    let sock = net.connect(parseInt(config.BridgePort), '127.0.0.1');

    sock.once('connect', () => {
      this.isInitializing = false;
      this.onInitialized();
      sock.end();
    });

    sock.once('error', () => this.isInitializing = true);

    // Keep a buffer of logs from the daemon and when we see the bridge is
    // established, we can safely proceed to do everything else
    const handleLogEvent = (e, data) => {
      this.logStack.unshift(data);

      if (this.logStack.length > 50) {
        this.logStack.pop();
      }

      if (data.msg.includes('establishing local bridge')) {
        this.isInitializing = false;
        this.onInitialized();
      }
    };

    ipcRenderer.on('log', handleLogEvent).on('err', handleLogEvent);
  }
});
