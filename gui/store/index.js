import ObjectList from 'object-list';
import Logs from 'logs';
import State from 'state';
import ipcRenderer from 'electron';
import boscar from 'boscar';
import net from 'net';

const config = require('rc')('orc', require('../bin/config'));

let isInitializing = true,
    errStack = [];

export default class Store extends State{
  constructor() {
    super();
    this.controlClient = new boscar.Client();
    this.state.isInitializing = true;
  }

  checkAlreadyRunning() {
    return new Promise((resolve, reject) => {
      let sock = net.connect(parseInt(config.BridgePort), '127.0.0.1');
      // First check if the bridge is running already (the page was reloaded)
      sock.once('connect', () => {
        sock.end();
        resolve({...appModel, isInitializing=false});
      });

      sock.once('error', () => reject());
    });
  }

  _initConnection() {
    return new Promise((resolve, reject) => {
      const handleInitEvent = (e, data) => {
        if (e) reject(e);
        if (data.msg.includes('establishing local bridge')) {
          ipcRenderer
            .removeListener('log', handleInitEvent)
            .removeListener('err', handleInitEvent);
          resolve();
        }
      };

      ipcRenderer.on('log', handleInitEvent).on('err', handleInitEvent);
    });
  }

  connectToControlPort() {
    this.controlClient.connect(parseInt(config.ControlPort))
      .on('error', (err) => {
        this.commit(err);
        console.error(err);
      });
  },

  async connect() {
    let appState;
    //don't commit this error to app state, it failed to find bridge, so init
    let [err, result] = await State.resolveTo(this.checkAlreadyRunning());

    if (err) {
      [err, result] = await State.resolveTo(this._initConnection());
    }

    if (err) {
    //commit this error to app state, as bridge can't be started
      this.commit(err);
    }

    connectToControlPort();
    let appState = _initAppState()
    //commit initial app states as part of this state's state
    return this.commit(err, {...appState, {isInitializing:false}});
  }
};

function _initAppState(controlClient) {
  return {
    objectList: new ObjectList(),
    profile: new Profile(controlClient),
    logs: new Logs()
  }
}
