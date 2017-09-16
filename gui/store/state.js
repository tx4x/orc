export default class State {

  static resolveTo(promise) {
    return promise.then(data => {
      return [null, data];
    })
    .catch(err => [err]);
  }

  constructor() {
    this.state = {};//new Object(null);
    this.state.errStack = [];
    this.state.loading = true;
  }

  commit([err=null, data={}]) {
    if(err) {
        if (this.logStack.length > 50) {
          this.logStack.pop();
        }

        this.state.errStack.unshift(err);
        return;
    };

    this.state = {...this.state, ...data};
    //return this.state;
  }
}
