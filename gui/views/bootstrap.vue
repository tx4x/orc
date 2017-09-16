<template>
  <div v-if="app.isInitializing" id="main-loader">
    <div class="spinner"></div>
    <div id="loader-status">{{logs.logStack[0].msg}}</div>
  </div>
</template>

<script>
import appStore from '../app-store';

export {
  name: 'bootstrap',
  data: () => ({
    app: appStore.state,
    logs: appStore.logs.state
  })
};
</script>

<style>

</style>
