import Vue from 'vue';
import App from './app.vue';
import Vuetify from 'vuetify';

Vue.use(Vuetify);

new Vue({
  el: '#app',
  render: h => h(App)
});
