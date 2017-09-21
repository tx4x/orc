<template>
  <div>
  <div id="main-loader">
    <div class="spinner"></div>
    <div id="loader-status">
      <div v-for="log in logStack">{{log.msg}}</div>
      <div v-for="err in errStack">{{err.message}}</div>
    </div>
  </div>
  </div>
</template>

<script>
import appStore from '../app-store'

export default {
  name: 'bootstrap',
  data: () => {
    return appStore.daemonConnection.state;
  },
  created: function() {
    const navigateToApp = () => {
      this.$router.push('orc');
    };
    const onDaemonConnect = () => {
      appStore.controlConnection.connect(
        appStore.controlConnection.connectToControlPort()
      )
      .then(navigateToApp);
    };

    appStore.daemonConnection.connect().on('connected', onDaemonConnect);
  },
  destroyed: function() {
    appStore.daemonConnection.connect().removeAllListeners();
  }
};
</script>

<style scoped>
#main-loader {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  background: url('assets/logo-white.svg') center center no-repeat #591859;
  background-size: 100px;
}

.spinner {
  position: absolute;
  top: 50%;
  left: 50%;
  height: 144px;
  width: 144px;
  margin: -72px 0 0 -72px;
  border-radius: 100px;
  border-left: 12px double white;
  border-top: 12px solid white;
  border-right: 12px double white;
  border-bottom: 12px solid white;
  animation-name: rotate;
  animation-duration: 0.5s;
  animation-iteration-count: infinite;
  animation-timing-function: linear;
}

@keyframes rotate {
  from {
    -webkit-transform: rotate(0deg);
  }
  to {
    -webkit-transform: rotate(360deg);
  }
}

#loader-status {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 360px;
  text-align: center;
  margin-left: -180px;
  margin-top: 94px;
  font-size: 16px;
  font-family: monospace;
}

</style>
