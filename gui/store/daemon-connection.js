import State from './state'
import boscar from 'boscar';
import https from 'https';
import http from 'http';
import FormData from 'form-data';
import fs from 'fs';
import net from 'net';
import async from 'async';
import mimeTypes from 'mime-types';
import path from 'path';
import { ipcRenderer } from 'electron';
import EventEmitter from 'events';

export default class DaemonConnection extends State {
  constructor({ ...config }) {
    super();
    this.config = config;
    this.conn = (Number(this.config.BridgeUseSSL)) ? https : http;
    this.state.logStack = [{ time: Date.now(), msg: 'starting orc daemon' }];
  }

  connect() {
    const eventEmitter = new EventEmitter();
    const handleErrorEvent = (ev, err) => this.commit(err.message);

    ipcRenderer.on('log', this.handleLogEvent.bind(this));

    async.retry({ times: 60, interval: 2000 }, (done) => {
      this._checkAlreadyRunning().then(() => done()).catch(err => done(err));
    }, () => eventEmitter.emit('connected'));

    ipcRenderer.on('err', handleErrorEvent);

    eventEmitter.once('removeListener', () => {
      ipcRenderer.removeListener('log', this.handleLogEvent.bind(this));
      ipcRenderer.removeListener('err', handleErrorEvent);
    });

    return eventEmitter;
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
      this.conn.request({
        method: 'GET',
        auth: this.config.BridgeAuthenticationUser + ':' +
          this.config.BridgeAuthenticationPassword,
        hostname: this.config.BridgeHostname,
        port: parseInt(this.config.BridgePort),
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
      let handleError = () => {
        reject(new Error(error));
      };

      this.conn.request({
        method: 'GET',
        hostname: this.config.BridgeHostname,
        port: parseInt(this.config.BridgePort),
        path: '/'+id,
        auth: this.config.BridgeAuthenticationUser + ':' +
          this.config.BridgeAuthenticationPassword,
        rejectUnauthorized: false
      }, (res) => {
        if (res.statusCode === 200) {
          return resolve(res);
        }

        let error = '';

        res.on('data', (d) => error += d.toString()).on('end', () => {
          reject(new Error(error));
        });
      }).on('error', reject).end();
    })
  }

  // Accepts a file path and access policies and uploads the object to the
  // network, returning the newly created pointer
  uploadObject(upath, opts = { policies: [] }) {
    const form = new FormData();
    const file = fs.createReadStream(upath);
    const size = fs.statSync(upath).size;
    const type = mimeTypes.contentType(path.extname(upath));

    // NB: Public data should have a '::RETRIEVE' policy
    if (opts.policies.length) {
      opts.policies.forEach((p) => form.append('policy', p));
    }

    form.append('file', file, {
      filename: path.basename(upath),
      contentType: type,
      knownLength: size
    });

    return new Promise((resolve, reject) => {
      form.submit({
        protocol: 'https:',
        hostname: this.config.BridgeHostname,
        port: parseInt(this.config.BridgePort),
        method: 'POST',
        path: '/',
        auth: this.config.BridgeAuthenticationUser + ':' +
          this.config.BridgeAuthenticationPassword,
        rejectUnauthorized: false
      }, (err, res) => {
        if (err) {
          return reject(err);
        }

        let body = '';

        res
          .on('error', reject)
          .on('data', (d) => {
            body += d.toString()
          })
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
      this.conn.request({
        method: 'DELETE',
        auth: this.config.BridgeAuthenticationUser + ':' +
          this.config.BridgeAuthenticationPassword,
          hostname: this.config.BridgeHostname,
          port: parseInt(this.config.BridgePort),
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
      this.conn.request({
        method: 'PUT',
        auth: this.config.BridgeAuthenticationUser + ':' +
          this.config.BridgeAuthenticationPassword,
          hostname: this.config.BridgeHostname,
          port: parseInt(this.config.BridgePort),
          path: '/',
          rejectUnauthorized: false
        }, (res) => {
          let body = '';

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
      this.conn.request({
        method: 'GET',
        auth: this.config.BridgeAuthenticationUser + ':' +
          this.config.BridgeAuthenticationPassword,
          hostname: this.config.BridgeHostname,
          port: parseInt(this.config.BridgePort),
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
    return new Promise((resolve, reject) => {
      this.conn.request({
        method: 'GET',
        path: '/',
        hostname: this.config.DirectoryHostname,
        port: parseInt(this.config.DirectoryPort),
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
      var sock = net.connect(parseInt(this.config.BridgePort), '127.0.0.1');
      // First check if the bridge is running already (the page was reloaded)
      sock.once('connect', () => {
        sock.end();
        return resolve(null, this.config);
      });

      sock.once('error', reject);
    });
  }
};
