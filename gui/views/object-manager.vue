<template>
  <div>
    <v-btn
      absolute
      top
      right
      fab
      @click.native="addObject"
    >
      <v-icon>add</v-icon>
      <input
        v-on:change="handleFileInput"
        ref="invisFileInput"
        type="file"
        class="aria-visible"
        multiple
      />
    </v-btn>
    <v-data-table
      v-bind:headers="headers"
      v-bind:items="objectList"
      v-bind:search="search"
      v-bind:pagination.sync="pagination"
      :total-items="listTotal"
      :loading="loading"
      class="elevation-1"
    >
      <template slot="headerCell" scope="props">
        <span v-tooltip:bottom="{ 'html': props.header.text }">
          {{ props.header.text }}
        </span>
      </template>
      <template slot="items" scope="props">
        <td>{{ props.item.name }}</td>
        <td  class="text-xs-right">{{ props.item.calories }}</td>
        <td  class="text-xs-right">{{ props.item.fat }}</td>
        <td  class="text-xs-right">{{ props.item.carbs }}</td>
        <td  class="text-xs-right">{{ props.item.protein }}</td>
        <td  class="text-xs-right">{{ props.item.sodium }}</td>
        <td  class="text-xs-right">{{ props.item.calcium }}</td>
        <td  class="text-xs-right">{{ props.item.iron }}</td>
      </template>
    </v-data-table>
  </div>
</template>

<script>
import appStore from '../app-store'

export default {
  name: 'object-manager',
  data: () => ({
    objectList: appStore.objectManager.state.list,
    totalItems: appStore.objectManager.state.listTotal
  }),
  watch: {
    pagination: {
      //fetch files
      // update state & total-items
    }
  },
  methods: {
    addObject() {
      this.$refs.invisFileInput.click();
    },
    handleFileInput(ev) {
      Array.prototype.forEach.call(ev.target.files, (file) => {
        appStore.ObjectManager.upload(file.path);
      })
    }
  }
};
</script>

<style>

</style>
