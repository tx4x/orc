import boscar from 'boscar';
const config = require('rc')('orc', require('../bin/config'));

export default class ControlConnection extends Connection {
  constructor() {
    super();
  }

  connectToControlPort() {
    let controlClient = new boscar.Client();
    let con;

    return new Promise((resolve, reject) => {
      try {
        con = controlClient.connect(parseInt(config.ControlPort));
      } catch(e) {
        return reject(new Error('Could not connect to controller'));
      }

      con.on('error', (err) => {
        this.commit(err);
        console.error(err);
      });

      resolve(con);
    });
  }

  // Queries the daemon for what the user has configured to allocate
  // and how much space is still available
  populateCapacityAllocation() {
    return new Promise(resolve, reject) => {
      controlClient.invoke('shards.size', [], (err, data) => {
        if (err) return reject(err);
        if (data) return resolve(data);
        return resolve({ available: '?', allocated: '?' });
      });
    })
  }
};
