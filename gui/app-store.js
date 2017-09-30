import * as Store from './store';
const config = require('rc')('orc', require('../bin/config'));

const AppStore = class extends Store.State {
  constructor() {
    super();
    //connections could be passed in and pooled as WeakMap with minor changes
    this.daemonConnection = new Store.DaemonConnection(config);
    this.controlConnection = new Store.ControlConnection(config);
    this.objectManager = new Store.ObjectManager(this.daemonConnection);
    this.profile = new Store.Profile(this.daemonConnection, this.controlConnection);
    //is modified freely by responsive directives
    this.drawer = true; //the app side door, boolean global state,
  }
};


const app = new AppStore();
export default app;
