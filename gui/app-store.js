import * as Store from './store';

const AppStore = class extends Store.State {
  constructor() {
    super();
    //connections could be passed in and pooled as WeakMap with minor changes
    this.daemonConnection = new Store.DaemonConnection();
    this.controlConnection = new Store.ControlConnection();
    this.objectList = new Store.ObjectList(this.daemonConnection);
    this.profile = new Store.Profile(this.daemonConnection, this.controlConnection);
  }

  async connect() {
    await this.daemonConnection.connect(this.daemonConnection.connectToDaemon())
      .then(this.controlConnection.connectToControlPort())
  }
};


const app = new AppStore();
export default app;
