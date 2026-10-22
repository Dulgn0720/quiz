<script setup lang="ts">
import { watch } from 'vue';
import { sound } from '@/game/sound';
import { useGameStore } from '@/stores/game';

/** Players' emoji reactions drifting up the host screen. */
const game = useGameStore();
let lastPop = 0;

watch(
  () => game.reactions.length,
  (n, before) => {
    // One soft pop at most every 150 ms, however many reactions arrive.
    if (n > (before ?? 0) && Date.now() - lastPop > 150) {
      lastPop = Date.now();
      sound.play('pop');
    }
  },
);
</script>

<template>
  <div class="pointer-events-none fixed inset-0 z-10 overflow-hidden" aria-hidden="true">
    <div
      v-for="r in game.reactions"
      :key="r.id"
      class="reaction-float absolute bottom-0 flex flex-col items-center"
      :style="{ left: `${r.x}%`, '--sway': `${(r.id % 2 ? 1 : -1) * (10 + (r.id % 5) * 6)}px` }"
    >
      <span class="text-5xl drop-shadow-lg">{{ r.emoji }}</span>
      <span class="-mt-2 rounded-full bg-white/15 px-1.5 text-lg backdrop-blur">{{ r.avatar }}</span>
    </div>
  </div>
</template>

<style scoped>
.reaction-float {
  animation: drift 3.4s cubic-bezier(0.2, 0.6, 0.4, 1) forwards;
}
@keyframes drift {
  0% {
    transform: translate(0, 20px) scale(0.5);
    opacity: 0;
  }
  10% {
    transform: translate(0, -40px) scale(1.1);
    opacity: 1;
  }
  50% {
    transform: translate(var(--sway), -40vh) scale(1);
  }
  100% {
    transform: translate(calc(var(--sway) * -1), -85vh) scale(0.9);
    opacity: 0;
  }
}
</style>
