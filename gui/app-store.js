//Application Store Instance
import * from './store';

const class AppStore extends State{
  constructor() {
    //connections could be passed in and pooled with minor changes
    this.dconn = new DaemonConnection();
    this.contconn = new ControlConnection();
  }

  async connect() {
    await this.dconn.connect(this.dconn.connectToDaemon())
      .then(this.contconn.connectToControlPort())
      .then(() => {
        this._createStateTree();
      })
  }

  _createStateTree() {
    return {
      objectList: new ObjectList(this.dconn),
      profile: new Profile(this.dconn, this.contconn)
    }
  }
}


const appStore = new AppStore();
export AppStore;
