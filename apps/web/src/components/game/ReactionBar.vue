<script setup lang="ts">
import { REACTIONS, type Reaction } from '@quiz/shared';
import { ref } from 'vue';
import { sound } from '@/game/sound';
import { useGameStore } from '@/stores/game';

/** Players cheer from their phones; reactions float up on the big screen. */
const game = useGameStore();
const popped = ref<{ id: number; emoji: Reaction }[]>([]);
let id = 0;

function send(emoji: Reaction): void {
  game.react(emoji);
  sound.play('pop');
  if (navigator.vibrate) navigator.vibrate(10);
  const item = { id: ++id, emoji };
  popped.value = [...popped.value, item];
  setTimeout(() => (popped.value = popped.value.filter((p) => p.id !== item.id)), 700);
}
</script>

<template>
  <div class="relative mx-auto flex w-fit gap-1 rounded-full bg-white/5 p-1.5 ring-1 ring-white/10" role="group" :aria-label="$t('game.reactions.label')">
    <button
      v-for="emoji in REACTIONS"
      :key="emoji"
      type="button"
      class="grid h-11 w-11 place-items-center rounded-full text-2xl transition hover:bg-white/10 active:scale-125"
      :aria-label="$t('game.reactions.send', { emoji })"
      @click="send(emoji)"
    >
      {{ emoji }}
    </button>
    <span
      v-for="p in popped"
      :key="p.id"
      class="reaction-pop pointer-events-none absolute left-1/2 top-0 text-3xl"
      aria-hidden="true"
    >
      {{ p.emoji }}
    </span>
  </div>
</template>

<style scoped>
.reaction-pop {
  animation: pop-up 700ms ease-out forwards;
}
@keyframes pop-up {
  from {
    transform: translate(-50%, 0) scale(0.6);
    opacity: 1;
  }
  to {
    transform: translate(-50%, -70px) scale(1.4);
    opacity: 0;
  }
}
</style>
