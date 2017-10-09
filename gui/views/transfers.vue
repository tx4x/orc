<template>
  <v-layout xs12 sm12 md12 lg12 xl12>
  <v-flex xs12>
    <v-card>
      <v-card-title primary-title>
        Uploads
      </v-card-title>

      <v-card-title
        v-bind:class="{
          'success': item.status === 'success',
          'error': item.status === 'fail',
          'primary': item.status === 'pending'
        }"
      >
        {{item.name}}
      </v-card-title>

      <v-card-content>
        <span pa-3>{{item.mimetype}}</span>
        <span pa-3>{{item.size}}</span>
      </v-card-content>

      <v-card-actions>
        <v-spacer></v-spacer>
        <v-button v-if="item.status === 'fail'">
          <v-icon>refresh</v-icon>
        </v-button>

        <v-button v-if="item.status === 'fail'">
          <v-icon>cancel</v-icon>
        </v-button>
      </v-card-actions>
    </v-card>

    <v-card>
      <v-card-title>
        Downloads
      </v-card-title>

      <v-card-text>

      </v-card-text>

      <v-card-actions>

      </v-card-actions>
    </v-card>


  </v-flex>
</v-layout>
<!--<div class="pt-5"></div> -->
</template>

<script>
import appStore from '../app-store'

export default {
  name: 'transfers',
  mixins: [ appStore.objectManager.methods ],
  data: () => ({
    ...appStore.objectManager.state,
    selected: []
  }),
  methods: {
    toggleAll() {
      if (this.selected.length) this.selected = [];
      else this.selected = this.list.slice();
    },
    toIds(objArr) {
      return objArr.map((elem) => {
        return elem.id
      })
    }
  }
};
</script>

<style lang="stylus" scoped>
  .primary
    background-color: $theme.primary
  .success
    background-color: $theme.success
  .error
    background-color: $theme.error
</style>
