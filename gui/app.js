import Vue from 'vue';
import vuetify from 'vuetify';
import router from './router.vue'
Vue.use(vuetify);

const app = new Vue(router).$mount('#app');
