<template>
  <div>
  <div v-if="isInitializing" id="main-loader">
    <div class="spinner"></div>
    <div id="loader-status">{{logStack[0].msg}}</div>
  </div>
  </div>
</template>

<script>
import appStore from '../app-store'

export default {
  name: 'bootstrap',
  data: () => {
    return appStore.daemonConnection.state;
  }
};
</script>

<style scoped>

body {
  background: #2b2d2c;
  color: #fff;
  margin: 0;
  padding: 0
}

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
  height: 120px;
  width: 120px;
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
