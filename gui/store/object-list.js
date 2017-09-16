import State from 'state';
import https from 'https';
import FormData from 'form-data';
import fs from 'fs';
import mimeTypes from 'mime-types';
import path from 'path';

const config = require('rc')('orc', require('../bin/config'));

export default class ObjectList extends State{
  constructor() {
    super();
  }

  async getList() {
    let [err, state] = await State.resolveTo(this._loadObjectList());
    return this.commit(err, { ObjectList: state });
  }

  async download(id) {
    let [err, state] = await State.resolveTo(this._downloadObject(id));
    return this.commit(err, { download: state });
  }

  async upload(path, opts) {
    let [err, state] = await State.resolveTo(this._uploadObject(path, opts));
    return this.commit(err, { upload: state });
  }

  async destroy(id) {
    let [err, state] = await State.resolveTo(this._destroyObject(id));
    this.commit(err);
    await this.getList();
  }

  async importMagnet(href) {
    let [err, state] = await State.resolveTo(this._insertObjectFromLink(href));
    this.commit(err);
    await this.getList();
  }

  async exportMagnet(id) {
    let [err, state] = await State.resolveTo(this._getObjectMagnet(id));
    return this.commit(err, { magnet: state });
  }

  // Returns a list of Stated object pointers
  _loadObjectList() {
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
  _downloadObject(id) {
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
  _uploadObject(path, opts = { policies: [] }) {
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
  _destroyObject(id) {
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
  _insertObjectFromLink(href) {
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
  _getObjectMagnet(id) {
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

};
