import State from './state';

export default class ObjectManager extends State{
  constructor(connection) {
    super(connection);
    this.connection = connection;
  }

  async getList() {
    let [err, state] = await State.resolveTo(this.connection.loadObjectList());
    return this.commit(err, { list: state, listTotal: state.length });
  }

  async download(id) {
    let [err, state] = await State.resolveTo(this.connection.downloadObject(id));
    return this.commit(err, { download: state });
  }

  async upload(path, opts) {
    let [err, state] = await State.resolveTo(this.connection.uploadObject(path, opts));
    return this.commit(err, { upload: state });
  }

  async destroy(id) {
    let [err, state] = await State.resolveTo(this.connection.destroyObject(id));
    if(err) return this.commit(err);
    await this.getList();
  }

  async importMagnet(href) {
    let [err, state] = await State.resolveTo(this.connection.insertObjectFromLink(href));
    if(err) return this.commit(err);
    await this.getList();
  }

  async exportMagnet(id) {
    let [err, state] = await State.resolveTo(this.connection.getObjectMagnet(id));
    return this.commit(err, { magnet: state });
  }

};
