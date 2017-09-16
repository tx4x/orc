import vue from 'vue';
import vuetify from 'vuetify';
import VueRouter from 'vue-router';

import appStore from './app-store';

vue.use(vuetify);
vue.use(vueRouter);

let router = new VueRouter({
  routes: [
    {
      path: '/',
      component: require('views/bootstrap.vue')
    },
    {
      path: '/orc',
      component: require('views/app.vue'),
      children: [
        {
          path: '',
          component: require('views/use.vue'),
          beforeRouteUpdate: (to, prev, next) => {
            appStore.objectList.getList().then(() => {
              next();
            });
          }
        },
        {
          path: 'profile',
          component: require('views/profile.vue'),
          beforeRouteUpdate: (to, prev, next) => {
            appStore.profile.getCapacityDirectory().then(() => {
              next();
            });
          }
        }
      ]
    }
  ]
});

const app = new vue({
  router
}).$mount('#app');
