<template>
  <v-layout xs12 sm12 md12 lg12 xl12>
  <v-flex xs12>
    <v-card>
      <div></div>
      <v-speed-dial
        v-model="contextMenu"
        direction="right"
        absolute
        top
        left
      >
        <v-btn
          slot="activator"
          v-model="contextMenu"
          fab
          @click.native="addObject"
        >
          <v-icon>add</v-icon>
        </v-btn>

        <v-btn fab @click="dlItems(selected)"><v-icon>file_download</v-icon></v-btn>
        <v-btn fab @click="playItems(selected)"><v-icon>play_arrow</v-icon></v-btn>
        <v-btn fab @click="shareItems(selected)"><v-icon>share</v-icon></v-btn>
        <v-btn fab @click="deleteItems(selected)"><v-icon>delete</v-icon></v-btn>
      </v-speed-dial>

      <v-card-title mt-1>

      </v-card-title>
      <v-data-table
        v-model="selected"
        v-bind:headers="headers"
        v-bind:items="list"
        v-bind:search="search"
        v-bind:pagination.sync="pagination"
        :total-items="listTotal"
        :loading="loading"
        class="elevation-1"
        selected-key="id"
      >

        <template slot="headers" scope="props">
          <tr>
            <th>
              <v-checkbox
                primary
                hide-details
                @click.native="toggleAll"
                :input-value="props.all"
                :indeterminate="props.indeterminate"
              ></v-checkbox>

              <th v-for="header in props.headers" :key="header.text"
                :class="['column sortable', pagination.descending ? 'desc' : 'asc', header.value === pagination.sortBy ? 'active' : '']"
                @click="changeSort(header.value)"
              >
                <v-icon>arrow_upward</v-icon>
                {{ header.text }}
              </th>
            </th>
          </tr>
        </template>
        <template slot="items" scope="props">
          <td>
          <v-checkbox
            primary
            hide-details
            v-model="props.selected"
          ></v-checkbox>
          </td>
          <td class="text-xs-left">{{ props.item.status }}</td>
          <td>{{ props.item.name }}</td>
          <td class="text-xs-left">{{ props.item.mimetype }}</td>
          <td class="text-xs-left">{{ props.item.size }}</td>
        </template>
      </v-data-table>

    </v-card>
  </v-flex>
  <input
    v-on:change="handleFileInput"
    ref="invisFileInput"
    type="file"
    class="aria-visible"
    multiple
  />
</v-layout>

</template>

<script>
import appStore from '../app-store'

export default {
  name: 'object-manager',
  data: () => ({
    ...appStore.objectManager.state,
    pagination: {
      sortBy: 'name',
      descending: false
    },
    selected: [],
    contextMenu: {
      isActive: false
    },
    headers: [
      { text: '', value: 'status' },
      { text: 'Name', value: 'name' },
      { text: 'Type', value: 'mimetype' },
      { text: 'Size', value: 'size' }
    ]
  }),
  watch: {
    pagination: {
      handler: () => appStore.objectManager.getList,
      deep: true
    },
    selected: {
      handler: function(val) {
        this.contextMenu.isActive = val.length > 0;
      },
      deep: true
    }
  },
  methods: {
    deleteItem: appStore.objectManager.destroy,
    dlItem: appStore.objectManager.download,
    shareItem: appStore.objectManager.exportMagnet,
    importItem: appStore.objectManager.importMagnet,
    addObject() {
      this.$refs.invisFileInput.click();
    },
    handleFileInput(ev) {
      Array.prototype.map.call(ev.target.files, (file) =>
        appStore.objectManager.upload(file.path)
      );
    },
    playItem(id) {

    },
    toggleAll () {
      if (this.selected.length) this.selected = [];
      else this.selected = this.list.slice();
    },
    changeSort (column) {
      if (this.pagination.sortBy === column) {
        this.pagination.descending = !this.pagination.descending
      } else {
        this.pagination.sortBy = column
        this.pagination.descending = false
      }
    }
  }
};
</script>

<style>

</style>
