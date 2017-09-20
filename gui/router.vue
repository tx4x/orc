<template>
  <router-view></router-view>
</template>

<script>
import VueRouter from 'vue-router'
import appStore from './app-store'

import bootstrap from './views/bootstrap.vue'
import navPrimary from './views/nav-primary.vue'
import use from './views/use.vue'
import profile from './views/profile.vue'

import Vue from 'vue';
Vue.use(VueRouter);

let router = new VueRouter({
  routes: [
    {
      path: '/',
      component: bootstrap
    },
    {
      path: '/orc',
      component: navPrimary,
      children: [
        {
          path: '',
          component: use,
          beforeRouteUpdate: (to, prev, next) => {
            appStore.objectList.getList().then(next);
          }
        },
        {
          path: 'profile',
          component: profile,
          beforeRouteUpdate: (to, prev, next) => {
            appStore.profile.getCapacityDirectory().then(next);
          }
        }
      ]
    }
  ]
});

export default {
  router,
  name:'router'
};

</script>

<style lang="stylus" src="./assets/css/main.styl"></style>
