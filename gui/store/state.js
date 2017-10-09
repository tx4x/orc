import assert from 'assert'
import Vue from 'vue'

export default class State {

  static resolveTo(promise) {
    assert(promise instanceof Promise);
    return promise.then((data) => {
      return [null, data || {}];
    })
    .catch(err => [err, {}]);
  }

  constructor() {
    //state never needs to inherit from Object, it's props are only replaced
    this.state = Object.create(null);
    this.state.errStack = [];
  }

  get methods() {
    return Object.getOwnPropertyNames(Object.getPrototypeOf(this))
      .reduce((prev, prop) => {
        if(typeof this[prop] === 'function') {
          //Vue will bind to vue instance, when mixed-in, provide a wrapper fn
          prev.methods[prop] = (...args) => this[prop](...args);
        }
        return prev;
      }, { methods: {} }
    );
  }

  commit(err, data) {
    if(err) {
        if (this.state.errStack.length > 50) {
          this.state.errStack.pop();
        }

        this.state.errStack.unshift(err.message);
    }

    if(data) {
      /*
      for (const key in data) {
        Vue.set(this.state, key, data[key])
      }
      */
      this.state = Object.assign({}, this.state, data);
    }
    console.log(this.state);
    return this.state;
  }
}
