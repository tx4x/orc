<template>
  <v-layout xs12 sm12 md12 lg12 xl12>
  <v-flex xs12>
    <v-card>
      <div></div>
      <v-btn
        fab
        top
        left
        absolute
        @click.native="addObjects"
      >
        <v-icon>file_upload</v-icon>
      </v-btn>
      <v-speed-dial
        direction="right"
        absolute
        top
        left
        id="moveoverhack"
        :isOpen="isMenuOpen > 0"
      >
        <v-btn
          slot="activator"
          fab
          @click.native="importMagnetList"
        >
          <v-icon>add</v-icon>
        </v-btn>
        <v-btn fab @click="downloadList(selected)"><v-icon>file_download</v-icon></v-btn>
        <v-btn fab @click="playItems(selected)"><v-icon>play_arrow</v-icon></v-btn>
        <v-btn fab @click="exportMagnetList(selected)"><v-icon>share</v-icon></v-btn>
        <v-btn fab @click="destroyList(selected)"><v-icon>delete</v-icon></v-btn>
      </v-speed-dial>

      <div class="pt-5"></div>

      <v-data-table
        id="objectupload"
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
            <th style="width:5%;">
              <v-checkbox
                primary
                hide-details
                @click.native="toggleAll"
                :input-value="props.all"
                :indeterminate="props.indeterminate"
              ></v-checkbox>

              <th style="width:5%;">
                <!--Status-->
                <v-icon style="width:25px;">cloud upload</v-icon>
              </th>

              <th style="width:30%;">
                Name
              </th>

              <th style="width:30%;">
                Type
              </th>

              <th style="width:30%;">
                Size
              </th>


<!-- saving for sort reference
              <th v-for="header in props.headers" :key="header.text"
                :class="getSortClasses(header)"
                @click="changeSort(header.value)"
              >
                <v-icon>arrow_upward</v-icon>
                {{ header.text }}
              </th>
-->
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
    isMenuOpen: false,
    selected: [],
    headers: [
      { text: 'Status', value: 'status' },
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
        this.isMenuOpen = val.length > 0;
      },
      deep: true
    }
  },
  methods: {
    ...appStore.objectManager.downloadList,
    ...appStore.objectManager.exportMagnetList,
    ...appStore.objectManager.importMagnetList,
    ...appStore.objectManager.uploadList,
    ...appStore.objectManager.destroylist,
    addObjects() {
      this.$refs.invisFileInput.click();
    },
    handleFileInput(ev) {
      this.uploadList(ev.target.files);
    },
    playItem(id) {

    },
    toggleAll() {
      if (this.selected.length) this.selected = [];
      else this.selected = this.list.slice();
    },
    changeSort(column) {
      if (this.pagination.sortBy === column) {
        this.pagination.descending = !this.pagination.descending
      } else {
        this.pagination.sortBy = column
        this.pagination.descending = false
      }
    },
    getSortClasses(header) {
      return ['column sortable',
        this.pagination.descending ? 'desc' : 'asc',
        header.value === this.pagination.sortBy ? 'active' : ''
      ];
    }
  }
};
</script>

<style lang="stylus">
#moveoverhack
  left: 68px;
</style>
