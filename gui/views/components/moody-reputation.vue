<template>
    <v-icon
      x-large
      v-bind:v-badge="currMood"
    >
      account_circle
    </v-icon>
</template>

<script>
const moods = [
  'sentiment-very-dissatisfied.overlap.icon.right',
  'sentiment-dissatisfied.overlap.icon.right',
  'sentiment-neutral.overlap.icon.right',
  'sentiment-satisfied.overlap.icon.right',
  'sentiment-very-satisfied.overlap.icon.right'
];

let currMood;

export default {
  name:'moody-reputation',
  props: {
    curr: { //the current value
      type: Number,
      required: true
    },
    total: { //the total possible value
      type: Number,
      required: true
    },
    distribution: { //distribution out of 100, rounded
      type: Array,
      default: [20, 20, 20, 20, 20],
      required: false,
      validator: (value) => {
        if(value.length < 5) { return false; }
        let total = 0;

        value.forEach((dist) => [
          total += dist;
        ]);

        return (total === 100) ? true : false;
      }
    }
  },
  data: () => {
    return currMood;
  },
  watch: {
    curr: function(newVal) {
      let percent = Math.round(newVal / this.total);
      let moodPercent = 0;
      let mood;
      this.distribution.forEach((dist, ind) => {
        moodPercent += dist;
        if(percent <=  moodPercent * this.) {
          mood = moods[ind];
        }
      });
      this.currMood = mood;
    }
  }
}
</script>

<style></style>
