import boscar from 'boscar';
import https from 'https';
import FormData from 'form-data';
import fs from 'fs';
import mimeTypes from 'mime-types';
import path from 'path';
import ipcRenderer from 'electron';

const config = require('rc')('orc', require('../bin/config'));


export default class DaemonConnection extends Connection {
  constructor() {
    super();
    this.state.isInitializing = true;
    this.state.logStack = [{ time: Date.now(), msg: 'starting orc daemon' }];

    ipcRenderer.on('log', this.handleLogEvent);
  }

  connectToDaemon() {
    return new Promise((resolve, reject) => {
      this._checkAlreadyRunning()
        .then(resolve)
        .catch(() => {
          this._initConnection()
            .then(resolve)
            .catch(reject);
        })

    });
  }

  handleLogEvent(e, data) {
    //no need to commit, vue will track array changes
    if (this.state.logStack.length > 50) {
      this.state.logStack.pop();
    }

    this.state.logStack.unshift(data);
  }

  // Returns a list of Stated object pointers
  loadObjectList() {
    return new Promise((resolve, reject) => {
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

        res.on('error', reject);
        res.on('data', (data) => body += data.toString());

        res.on('end', () => {
          resolve(JSON.parse(body));
        });
      }).on('error', reject).end();
    });
  }

  // Accepts an object id and instructs the daemon to retreive the shards
  // from the network, then returns a readable stream of the object
  downloadObject(id) {
    return new Promise((resolve, reject) => {
      https.request({
        method: 'GET',
        hostname: config.BridgeHostname,
        port: parseInt(config.BridgePort),
        path: '/',
        auth: config.BridgeAuthenticationUser + ':' +
          config.BridgeAuthenticationPassword,
        rejectUnauthorized: false
      }, (res) => {
        if (res.statusCode === 200) {
          return resolve(res);
        }

        let error = '';

        res.on('data', (d) => error += d.toString()).on('end', () => {
          reject(new Error(error));
        });
      }).on('error', reject);
    })
  }

  // Accepts a file path and access policies and uploads the object to the
  // network, returning the newly created pointer
  uploadObject(path, opts = { policies: [] }) {
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

    return new Promise((resolve, reject) => {
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
          return reject(err);
        }

        let body = '';

        res
          .on('error', reject)
          .on('data', (d) => body += d.toString())
          .on('end', () => {
            if (res.statusCode !== 201) {
              reject(new Error(body));
            } else {
              resolve(JSON.parse(body));
            }
          });
      });
    });
  }

  // Removes an object pointer from the list, marking it for reaping
  // by other nodes later
  destroyObject(id) {
    return new Promise((resolve, reject) => {
      https.request({
        method: 'DELETE',
        auth: config.BridgeAuthenticationUser + ':' +
          config.BridgeAuthenticationPassword,
          hostname: config.BridgeHostname,
          port: parseInt(config.BridgePort),
          path: `/${id}`,
          rejectUnauthorized: false
        }, (res) => {
          res.on('error', reject).on('end', resolve).resume();
        }).on('error', reject).end();
      });
  }

  // Instructs the daemon to resolve the magnet link and add the decrypted
  // pointer to it's local object list
  insertObjectFromLink(href) {
    return new Promise((resolve, reject) => {
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
          .on('error', reject)
          .on('data', (d) => body += d.toString())
          .on('end', () => {
            if (res.statusCode !== 200) {
              return reject(new Error(body));
            }

            resolve(JSON.parse(body));
          });
        }).on('error', reject).end(href);
      });
  }

  // Takes an object id and returns a shareable magnet link
  // The object must have been uploaded with the correct policies for other
  // users to be able to access it
  getObjectMagnet(id) {
    return new Promise((resolve, reject) => {
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

          res.on('error', reject);
          res.on('data', (data) => body += data.toString());
          res.on('end', () => resolve(body));
        }).on('error', reject).end();
    });
  }

  loadCapacityDirectory() {
    return new Promise(resolve, reject) => {
      https.request({
        method: 'GET',
        path: '/',
        hostname: config.DirectoryHostname,
        port: parseInt(config.DirectoryPort),
        rejectUnauthorized: false
      }, (res) => {
        let body = '';

        res.on('error', reject);
        res.on('data', (data) => body += data.toString());

        res.on('end', () => {
          resolve(JSON.parse(body));
        });
      }).on('error', reject).end();
    });
  }

  _checkAlreadyRunning() {
    return new Promise((resolve, reject) => {
      let sock = net.connect(parseInt(config.BridgePort), '127.0.0.1');
      // First check if the bridge is running already (the page was reloaded)
      sock.once('connect', () => {
        sock.end();
        return resolve(null, { isInitializing: false });
      });

      sock.once('error', () => return reject());
    });
  }

  _initConnection() {
    return new Promise((resolve, reject) => {
      const handleInitEvent = (e, data) => {
        if (e) return reject(e);
        if (data.msg.includes('establishing local bridge')) {
          ipcRenderer
            .removeListener('log', handleInitEvent)
            .removeListener('err', handleInitEvent);
          return resolve(null, { isInitializing: false });
        }
      };

      ipcRenderer.on('log', handleInitEvent).on('err', handleInitEvent);
    });
  }

};
