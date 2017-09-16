<template>
<div v-if="isInitializing" id="main-loader">
  <div class="spinner"></div>
  <div id="loader-status">{{logStack[0].msg}}</div>
</div>
</template>

<script>

</script>

<style>

</style>
