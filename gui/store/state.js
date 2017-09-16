export default class State {

  static resolveTo(promise) {
    return promise.then(data => {
      return [null, data];
    })
    .catch(err => [err]);
  }

  constructor() {
    //state never needs to inherit from Object, it's props are only replaced
    this.state = Object.create(null);
    this.state.errStack = [];
    this.state.loading = true;
  }

  commit(err = null, data = Object.create(null)) {
    if(err) {
        if (this.errStack.length > 50) {
          this.errStack.pop();
        }

        this.state.errStack.unshift(err);
        return;
    };

    this.state = Object.create(null, {...this.state, ...data});
  }
}
