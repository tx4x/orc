import Vue from 'vue';
import App from './app.vue';
import Vuetify from 'vuetify';
import VueRouter from 'vue-router';

Vue.use(Vuetify);
Vue.use(VueRouter);

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
          component: require('views/use.vue')
        },
        {
          path: 'profile',
          component: require('views/profile.vue')
        }
      ]
    }
  ]
});

new Vue({
  router,
  created() {
    
  }
}).$mount('#app');
