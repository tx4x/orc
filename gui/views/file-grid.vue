<template>
  <v-data-table
    v-bind:headers="headers"
    v-bind:items="items"
    v-bind:search="search"
    v-bind:pagination.sync="pagination"
    :total-items="totalItems"
    :loading="loading"
    v-model="selected"
    selected-key="name"
    select-all
    class="elevation-1"
  >

    <template slot="headers" scope="props">

    </template>

    <template slot="items" scope="props">
      <td class="text-xs-right"></td>
      <td class="text-xs-right"></td>
      <td class="text-xs-right"></td>
    </template>

  </v-data-table>
</template>

<script>
module.exports = {
  name: 'file-grid',
  data: () => ({

  }),
  methods: {
    
  }
};
</script>

<style>

</style>
