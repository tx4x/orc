import State from 'state';
import ipcRenderer from 'electron';
import https from 'https';

const config = require('rc')('orc', require('../bin/config'));

export default class Profile extends State {
  constructor(controlconn, dconn) {
    super();
    this.connection = {
      control: controlconn,
      daemon: dconn
    };

    this.state.localCapacity = { allocated: '?', available: '?' };
    this.state.capacityDirectory = [];
    this.controlClient = controlClient;
  }

  async getCapacity() {
    let [err, state] = await State.resolveTo(
      this.connection.control.populateCapacityAllocation()
    );

    return this.commit(err, { localCapacity: state });
  }

  async getCapacityDirectory() {
    let [err, state] = await State.resolveTo(
      this.connection.daemon.loadCapacityDirectory()
    );
//TODO possible type error here with array
    return this.commit(err, { capacityDirectory: state });
  }
};
