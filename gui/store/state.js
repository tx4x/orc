import assert from 'assert';

export default class State {

  static resolveTo(promise) {
    assert(promise instanceof Promise);
    return promise.then(data => {
      return [null, data];
    })
    .catch(err => [err]);
  }

  constructor() {
    //state never needs to inherit from Object, it's props are only replaced
    this.state = Object.create(null);
    this.state.errStack = [];
  }

  commit(err = null, data = Object.create(null)) {
    if(err) {
        if (this.state.errStack.length > 50) {
          this.state.errStack.pop();
        }

        this.state.errStack.unshift(err);
        return;
    }

    this.state = Object.assign(this.state, data);
  }
}
