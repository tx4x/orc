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
      v-bind:items="list"
      v-bind:search="search"
      v-bind:pagination.sync="pagination"
      :total-items="listTotal"
      :loading="loading"
      class="elevation-1"
    >
      <template slot="headerCell" scope="props">
        <input type="text"></input>
        <span v-tooltip:bottom="{ 'html': props.header.text }">
          {{ props.header.text }}
        </span>
      </template>
      <template slot="items" scope="props">
        <td>{{ props.item.name }}</td>
        <td class="text-xs-right">{{ props.item.mimetype }}</td>
        <td class="text-xs-right">{{ props.item.size }}</td>
        <td class="text-xs-right">{{ props.item.status }}</td>
        <td class="text-xs-right">
          <v-btn icon @click="deleteItem(props.item.id)"><v-icon>delete</v-icon></v-btn>
        </td>
        <td class="text-xs-right">
          <v-btn icon @click="dlItem(props.item.id)"><v-icon>file_download</v-icon></v-btn>
        </td>
        <td class="text-xs-right">
          <v-btn icon @click="shareItem(props.item.id)"><v-icon>share</v-icon></v-btn>
        </td>
        <td class="text-xs-right">
          <v-btn icon @click="playItem(props.item.id)"><v-icon>play</v-icon></v-btn>
        </td>
      </template>
    </v-data-table>
  </div>
</template>

<script>
import appStore from '../app-store'

export default {
  name: 'object-manager',
  data: () => appStore.objectManager.state,
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
      Array.prototype.map.call(ev.target.files, (file) => {
        return appStore.objectManager.upload(file.path);
      });
    },
    deleteItem(id) {
      return appStore.objectManager.destroy(id);
    },
    dlItem(id) {
      return appStore.objectManager.download(id);
    },
    shareItem(id) {
      return appStore.objectManager.exportMagnet(id);
    },
    importItem(link) {
      return appStore.objectManager.importMagnet(link);
    },
    playItem(id) {

    }
  }
};
</script>

<style>

</style>
