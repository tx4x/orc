<template>
  <v-app
    dark
    id="e3"
    toolbar
  >
<!--Left App Drawer -->
    <v-navigation-drawer
      dark
      class="pb-0"
      persistent
      height="100%"
      clipped
      absolute
      enable-resize-watcher
      v-model="drawer"
    >
      <v-list dense>
        <!--
        <v-list-tile v-for="item in items" :key="item.text" @click="">
          <v-list-tile-action>
            <v-icon>{{ item.icon }}</v-icon>
          </v-list-tile-action>
          <v-list-tile-content>
            <v-list-tile-title>
              {{ item.text }}
            </v-list-tile-title>
          </v-list-tile-content>
        </v-list-tile>
      -->
        <v-subheader class="mt-3 grey--text text--darken-1">TAGS</v-subheader>

        <v-list-tile class="mt-3" @click="">
          <v-list-tile-action>
            <v-icon class="grey--text text--darken-1">add_circle_outline</v-icon>
          </v-list-tile-action>
          <v-list-tile-title class="grey--text text--darken-1">Add Tag</v-list-tile-title>
        </v-list-tile>
      </v-list>
    </v-navigation-drawer>

<!--Top Toolbar -->
    <v-toolbar class="purple" fixed>
      <v-toolbar-title>
        <v-toolbar-side-icon @click.stop="drawer = !drawer"></v-toolbar-side-icon>
        <v-icon class="ml-3">weekend</v-icon>
      </v-toolbar-title>

      <v-spacer></v-spacer>

      <v-text-field
        label="Search..."
        single-line
        append-icon="search"
        dark
        hide-details
      ></v-text-field>
      <v-btn icon>
        <v-icon>settings</v-icon>
      </v-btn>
    </v-toolbar dark>

<!--Main Interface -->
    <main>
      <v-container fill-height>
        <v-layout>
          <v-flex xs12>
            <v-card height="300px">
               <router-view></router-view>
            </v-card>
          </v-flex>
        </v-layout>
      </v-container>
    </main>

  </v-app>
</template>


<script>
export default {
  name: 'layout'
};

</script>

<style>

</style>
