<template>
<v-icon v-bind:class="statusMap[props.status].classList">
  {{statusMap[props.status].icon}}
</v-icon>
</template>

<script>

const statusMap = {
  finished: {
    icon: 'check',
    classList: 'success'
  },
  pending: {
    icon: 'arrow_upward',
    classList: 'warning'
  },
  failed: {
    icon: 'close',
    classList: 'error'
  }
}

export default {
  name:'object-status',
  props: {
    status: {
      type: String,
      required: true
    }
  },
  data: () => (statusMap)
}
</script>

<style>

</style>
