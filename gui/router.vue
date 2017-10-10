<template>
  <router-view></router-view>
</template>

<script>
import VueRouter from 'vue-router'
import appStore from './app-store'

import bootstrap from './views/bootstrap.vue'
import layout from './views/layout.vue'
import objectManager from './views/object-manager.vue'

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
      component: layout,
      children: [
        {
          path: '',
          component: objectManager,
          beforeEnter: (to, prev, next) => {
            appStore.objectManager.getList().then(next);
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

<style lang="stylus">
/** Vuetify **/

@require '../node_modules/vuetify/src/stylus/settings/_colors'

$theme = {
  primary: $purple.base,
  accent: $light-green.accent-2,
  secondary: $light-green.darken-1,
  info: $light-green.darken-1,
  warning: $orange.lighten-3,
  error: $deep-orange.lighten-3,
  success: $light-green.accent-2
}

/** $navigation-drawer-width := 100% **/

@require '../node_modules/vuetify/src/stylus/main'

/** Fonts **/

@font-face
  font-family 'Material Icons'
  font-style normal
  font-weight 400
  src url(assets/MaterialIcons-Regular.eot)
  src local('Material Icons'),
    local('MaterialIcons-Regular'),
    url(assets/MaterialIcons-Regular.woff2) format('woff2'),
    url(assets/MaterialIcons-Regular.woff) format('woff'),
    url(assets/MaterialIcons-Regular.ttf) format('truetype')

.material-icons
  font-family: 'Material Icons'
  font-weight: normal
  font-style: normal
  font-size: 24px
  display: inline-block
  line-height: 1
  text-transform: none
  letter-spacing: normal
  word-wrap: normal
  white-space: nowrap
  direction: ltr

  /* Support for all WebKit browsers. */
  -webkit-font-smoothing: antialiased
  /* Support for Safari and Chrome. */
  text-rendering: optimizeLegibility

  /* Support for Firefox. */
  -moz-osx-font-smoothing: grayscale

  /* Support for IE. */
  font-feature-settings: 'liga'

/**
 * ORC Styles
 */

html
  overflow hidden

.aria-visible
  opacity 0
  width 0px
  height 0px
  position absolute
  top 0px
  left 0px

.speed-dial--top.speed-dial--absolute
  top 0%
</style>
