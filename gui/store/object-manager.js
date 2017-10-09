import State from './state';
import fs from 'fs';
import os from 'os';
import { shell, clipboard } from 'electron';
import path from 'path';
import promisify from 'util.promisify';

const HOME = os.homedir();
const DLDIR = '/Downloads'

export default class ObjectManager extends State{
  constructor(connection) {
    super();
    this.connection = connection;
    this.state.list = [];
//TODO: better partial upload/dl state management here & api
    //cause sets & weak maps don't work with Vue reactivity yet
    this.state.downloadPending = {};
    this.state.uploadPending = {};
    this.state.importPending = {};
    this.state.exportList = [];
  }

  async getList() {
    let [err, state] = await State.resolveTo(this.connection.loadObjectList());
    let total = (state instanceof Array) ? state.length : 0;
//TODO ...this is allowing vue to mutate Array state, ugly, hide in super.commit
    this.state.list.splice(0, Infinity, ...state);
    return Promise.resolve(this.state.list);
  }

  async download(id) {
    this.commit(null, { downloadPending: { [id]: 'pending' } });
    let local = this.getLocalPath(id);
    let checkFileAccess = promisify(fs.access);

    //first check download dir for local copy
    let [isUnaccessible] = await State.resolveTo(
      checkFileAccess(local, fs.constants.R_OK | fs.constants.F_OK)
    );

    if(!isUnaccessible) {
      return Promise.resolve(
        this.commit(null, { downloadPending: { [id]: 'success' } })
      );
    }

    //retrieve a local if one doesn't exist
    var [err, res] = await State.resolveTo(this.connection.downloadObject(id));
    if(err) return Promise.reject(this.commit(err, { downloadPending: { [id]: 'fail' } }));
    let pipe = new Promise((resolve, reject) => {
      let writeStream = fs.createWriteStream(local);
      res.pipe(writeStream)
        .on('finish', () => {
          resolve(this.commit(null, { downloadPending: { [id]: 'success' } }));
        })
        .on('error', (e) => {
          reject(this.commit(e.message, { downloadPending: { [id]: 'fail' } }));
        });
    });

    [err, res] = await State.resolveTo(pipe);

    if(err) return Promise.reject(this.commit(err, { downloadPending: { [id]: 'fail' } }));
    return Promise.resolve(this.commit(null, { downloadPending: { [id]: 'success' } }));
    /*
    state.pipe(writeStream)
      .on('finish', () => this.commit(null, { downloadPending: { [id]: 'success' } }))
      .on('error', (e) => this.commit(e.message, { downloadPending: { [id]: 'fail' } }));
    */
    return Promise.resolve();
  }

  downloadList(idArr) {
    return Promise.all(idArr.map(id => { return this.download(id) }));
  }

  clearDownloads() {
    this.commit(null, { downloadPending: {} });
  }

  async upload(fpath, opts) {
    this.commit(null, { uploadPending: { [fpath]: 'pending' } });
    let [err, state] = await State.resolveTo(this.connection.uploadObject(fpath, opts));
    if(err) return this.commit(err, { uploadPending: { [fpath]: 'fail' } });
    return this.commit(null, { uploadPending: { [fpath]: 'success' } });
  }

  uploadList(fileArr, opts) {
    return Promise.all(Array.prototype.map.call(fileArr, file => {
      return this.upload(file.path, opts)
    }));
  }

  clearUploads() {
    this.commit(null, { uploadPending: {} });
  }

  async destroy(id) {
    let [err, state] = await State.resolveTo(this.connection.destroyObject(id));
    if(err) return this.commit(err);
  }

  destroyList(idArr) {
    return Promise.all(idArr.map(id => { return this.destroy(id) }));
  }

  async importMagnet(href) {
    this.commit(null, { importPending: { [href]: 'pending' } });
    let [err, state] = await State.resolveTo(this.connection.insertObjectFromLink(href));
    if(err) return this.commit(err, { importPending: { [href]: 'fail' } });
    return this.commit(null, { importPending: { [href]: 'success' } });
  }

  importMagnetList(hrefArr) {
    return Promise.all(hrefArr.map(href => { return this.importMagnet(href) }));
  }

  clearMagnetImports() {
    return this.commit(null, { importPending: {} });
  }

  async exportMagnet(id) {
    let [err, state] = await State.resolveTo(this.connection.getObjectMagnet(id));
    if(err) return this.commit(err);
    this.state.exportList.push(state);
  }

  exportMagnetList(idArr) {
    this.state.exportList.splice(0, Infinity);
    return Promise.all(idArr.map(id => { return this.exportMagnet(id) }))
      .then(() => {
        console.log(this.state)
        clipboard.writeText(this.state.exportList.join())
      });
  }

  async playItem(id) {
    let local = this.getLocalPath(id);
    let [err, state] = await State.resolveTo(this.download(id));
    let isPlayable = shell.openItem(local);
    if(!isPlayable) {
      this.commit(new Error(`
        ${id}: File format cannot be played; please install the approtiate application.
      `));
    }
    return Promise.resolve();
  }

  playItems(idArr) {
    return Promise.all(idArr.map(id => { return this.playItem(id)}))
  }

  getLocalPath(id) {
    let item = this.state.list.find((item) => {
      return item.id === id;
    });

    if(item) {
      return path.format({
        dir: HOME + DLDIR,
        base: id + ' ' + item.name
      });
    } else {
      return null;
    }
  }
};
