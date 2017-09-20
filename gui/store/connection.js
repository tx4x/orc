import State from './state'
import assert from 'assert'

export default class Connection extends State {

  constructor() {
    super();
    this.state.connection = Object.create(null);
  }

  async connect(connectionPromise) {
    assert(connectionPromise instanceof Promise);

    let [err, conn] = await State.resolveTo(connectionPromise);
    return this.commit(err, {connection: conn});
  }
}
