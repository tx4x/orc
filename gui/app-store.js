import * as Store from './store';
const config = require('rc')('orc', require('../bin/config'));

const AppStore = class extends Store.State {
  constructor() {
    super();
    //connections could be passed in and pooled as WeakMap with minor changes
    this.daemonConnection = new Store.DaemonConnection(config);
    this.controlConnection = new Store.ControlConnection(config);
    this.objectList = new Store.ObjectList(this.daemonConnection);
    this.profile = new Store.Profile(this.daemonConnection, this.controlConnection);
  }
};


const app = new AppStore();
export default app;
