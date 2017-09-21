import boscar from 'boscar';
import State from './state'

export default class ControlConnection extends State {
  constructor({ ...config }) {
    super();
    this.config = config;
  }

  connectToControlPort() {
    return new Promise((resolve, reject) => {
      var controlClient = new boscar.Client();
      controlClient.connect(parseInt(this.config.ControlPort));

      controlClient.on('error', (err) => {
        this.commit(err.message);
        console.error(err);
      });

      return resolve();
    });
  }

  async connect(connectionPromise) {
    let [err] = await State.resolveTo(connectionPromise);
    return this.commit(err);
  }

  // Queries the daemon for what the user has configured to allocate
  // and how much space is still available
  populateCapacityAllocation() {
    return new Promise((resolve, reject) => {
      controlClient.invoke('shards.size', [], (err, data) => {
        if (err) return reject(err);
        if (data) return resolve(data);
        return resolve({ available: '?', allocated: '?' });
      });
    })
  }
};
