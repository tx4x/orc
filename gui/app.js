import Vue from 'vue';
import Vuetify from 'vuetify';
import router from './router.vue'

Vue.use(Vuetify);

const app = new Vue(router).$mount('#app');
