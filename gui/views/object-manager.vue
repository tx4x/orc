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
          ref="magnetButton"
          @click.native.stop="handleMagnetImportClick()"
        >
          <v-icon>add</v-icon>
        </v-btn>
        <v-btn fab @click.native.stop="downloadList(toIds(selected))"><v-icon>file_download</v-icon></v-btn>
        <v-btn fab @click.native.stop="playItems(toIds(selected))"><v-icon>play_arrow</v-icon></v-btn>
        <v-btn fab @click.native.stop="exportMagnetList(toIds(selected))"><v-icon>share</v-icon></v-btn>
        <v-btn fab @click.native.stop="destroyList(toIds(selected))"><v-icon>delete</v-icon></v-btn>
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
  <v-dialog v-model="addMagnetDialogOpen" :origin="magnetImportOrigin" width="50%">
    <v-card>
      <v-card-title>
        <div class="headline">Import Magnet Links</div>
      </v-card-title>
      <v-card-text>Import files from the Orc network using comma-separated URLs</v-card-text>
        <v-text-field
          v-model="rawImportList"
          full-width
          multi-line
          single-line
        ></v-text-field>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn class="green--text darken-1" flat="flat" @click="handleImportSubmit">Import</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</v-layout>

</template>

<script>
import appStore from '../app-store'

export default {
  name: 'object-manager',
  mixins: [ appStore.objectManager.methods ],
  data: () => ({
    ...appStore.objectManager.state,
    pagination: {
      sortBy: 'name',
      descending: false
    },
    rawImportList: '',
    isMenuOpen: false,
    addMagnetDialogOpen: false,
    magnetImportOrigin: 'center center',
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
    },
    handleMagnetImportClick() {
      let getButtonOrigin = () => {
        let box = this.$refs.magnetButton.$el.getBoundingClientRect();
        let x = box.left + ( ( box.left + box.right) / 2 );
        let y = box.top + ( ( box.top + box.bottom) / 2 );
        return x + ' ' + y;
      }

      this.magnetImportOrigin = getButtonOrigin();
      this.addMagnetDialogOpen = true;
    },
    handleImportSubmit() {
      let imports = this.rawImportList.split(',');
      this.importMagnetList(imports);
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
#moveoverhack
  left: 68px;
</style>
