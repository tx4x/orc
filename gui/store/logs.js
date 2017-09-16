import State from 'state';
import ipcRenderer from 'electron';

export default class Logs extends State {
  constructor() {
    super();
    this.state.logStack = [{ time: Date.now(), msg: 'starting orc daemon' }];
    ipcRenderer.on('log', this.handleLogEvent);
  }

  handleLogEvent(e, data) {
    if (this.state.logStack.length > 50) {
      this.state.logStack.pop();
    }

    this.state.logStack.unshift(data);
  }
};
