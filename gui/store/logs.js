import State from 'state';
import ipcRenderer from 'electron';

export default class Logs extends State {
  constructor() {
    super();
    this.state.logStack = [{ time: Date.now(), msg: 'starting orc daemon' }];
    ipcRenderer.on('log', this.handleLogEvent);
  }

  handleLogEvent(e, data) {
    if (this.logStack.length > 50) {
      this.logStack.pop();
    }

    this.logStack.unshift(data);
  }
};
