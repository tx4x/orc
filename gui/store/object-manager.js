import State from './state';

export default class ObjectManager extends State{
  constructor(connection) {
    super();
    this.connection = connection;
//TODO: better partial upload/dl state management here & api
    //cause sets & weak maps don't work with Vue reactivity yet
    this.state.downloadPending = {};
    this.state.uploadPending = {};
    this.state.importPending = {};
    this.state.exportPending = {};
  }

  async getList() {
    let [err, state] = await State.resolveTo(this.connection.loadObjectList());
    return this.commit(err, { list: state, listTotal: state.length });
  }

  async download(id) {
    this.commit(null, { downloadPending: { [id]: 'pending' } });
    let [err, state] = await State.resolveTo(this.connection.downloadObject(id));
    if(err) {
      return this.commit(err, { downloadPending: { [id]: 'fail' } });
    }

    return this.commit(null, { downloadPending: { [id]: 'success' } });
  }

  downloadList(idArr) {
    idArr.map((id) => this.download(id));
  }

  clearDownloads() {
    this.commit(null, { downloadPending: {} });
  }

  async upload(file, opts) {
    let path = file.path;
    this.commit(null, { uploadPending: { [path]: false } });
    let [err, state] = await State.resolveTo(this.connection.uploadObject(path, opts));
    this.commit(err, { uploadPending: { [path]: true } });
  }

  async uploadList(fileArr, opts) {
    return Promise.resolve(Array.prototype.map.call(fileArr, (file) => {
      return this.upload(file, opts)
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
    idArr.map((id) => this.destroy(id));
  }

  async importMagnet(href) {
    this.commit(null, { importPending: { [href]: false } });
    let [err, state] = await State.resolveTo(this.connection.insertObjectFromLink(href));
    return this.commit(err, { importPending: { [href]: true } });
  }

  importMagnetList(hrefArr) {
    hrefArr.map((hrefArr) => this.importMagnet(href));
  }

  clearMagnetImports() {
    return this.commit(null, { importPending: {} });
  }

  async exportMagnet(id) {
    this.commit(null, { exportPending: { [id]: false } });
    let [err, state] = await State.resolveTo(this.connection.getObjectMagnet(id));
    this.commit(err, { exportPending: { [id]: true } });
  }

  exportMagnetList(idArr) {
    idArr.map((id) => this.exportMagnet(id));
  }

  clearMagnetExports() {
    this.commit(null, { exportPending: {} });
  }
};
