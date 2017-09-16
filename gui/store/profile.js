import State from 'state';
import ipcRenderer from 'electron';
import https from 'https';

const config = require('rc')('orc', require('../bin/config'));

export default class Profile extends State {
  constructor(controlClient) {
    super();
    this.state.localCapacity = { allocated: '?', available: '?' };
    this.state.capacityDirectory = [];
    this.controlClient = controlClient;
  }

  async getCapacity() {
    let [err, state] = await State.resolveTo(
      this._populateCapacityAllocation()
    );

    return this.commit(err, { localCapacity: state });
  }

  async getCapacityDirectory() {
    let [err, state] = await State.resolveTo(
      this._populateCapacityAllocation()
    );
//TODO possible type error here with array
    return this.commit(err, { capacityDirectory: state });
  }

  // Queries the daemon for what the user has configured to allocate
  // and how much space is still available
  _populateCapacityAllocation() {
    return new Promise(resolve, reject) => {
      this.controlClient.invoke('shards.size', [], (err, data) => {
        if (err) return reject(err);
        if (data) return resolve(data);
        return resolve({ available: '?', allocated: '?' });
      });
    })
  }

  _loadCapacityDirectory() {
    return new Promise(resolve, reject) => {
      https.request({
        method: 'GET',
        path: '/',
        hostname: config.DirectoryHostname,
        port: parseInt(config.DirectoryPort),
        rejectUnauthorized: false
      }, (res) => {
        let body = '';

        res.on('error', reject);
        res.on('data', (data) => body += data.toString());

        res.on('end', () => {
          resolve(JSON.parse(body));
        });
      }).on('error', reject).end();
    });
  }

};
