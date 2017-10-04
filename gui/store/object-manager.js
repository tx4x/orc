import State from './state';

export default class ObjectManager extends State{
  constructor(connection) {
    super(connection);
    this.connection = connection;
    //cause sets & weak maps don't work with Vue reactivity yet
    this.state.downloadPending = {};
    this.state.uploadPending = {};
    this.state.magnetList = [];
  }

  async getList() {
    let [err, state] = await State.resolveTo(this.connection.loadObjectList());
    return this.commit(err, { list: state, listTotal: state.length });
  }

  async download(id) {
    this.commit(null, { downloadPending: { [id]: false } });
    let [err, state] = await State.resolveTo(this.connection.downloadObject(id));
    this.commit(err, { downloadPending: { [id]: true } });
  }

  downloadList(idArr) {
    idArr.map((id) => this.download(id));
  }

  clearDownloadList() {
    this.commit(null, { downloadPending: {} });
  }

  async upload(file, opts) {
    let path = file.path;
    this.commit(null, { uploadPending: { [path]: false } });
    let [err, state] = await State.resolveTo(this.connection.uploadObject(path, opts));
    this.commit(err, { uploadPending: { [path]: true } });
  }

  uploadList(fileArr, opts) {
    fileArr.map((file) => {
      this.upload(file, opts)
    });
  }

  clearDownloadList() {
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
    let [err, state] = await State.resolveTo(this.connection.insertObjectFromLink(href));
    if(err) return this.commit(err);
  }

  importMagnetList(hrefArr) {
    idArr.map((hrefArr) => this.importMagnet(href));
  }

  async exportMagnet(id) {
    let [err, state] = await State.resolveTo(this.connection.getObjectMagnet(id));
    if(err) return this.commit(err);
    this.state.magnetList.push(state);
  }

  exportMagnetList(idArr) {
    this.state.commit(null, { magnetList: [] });
    idArr.map((id) => this.exportMagnet(id));
  }
};
