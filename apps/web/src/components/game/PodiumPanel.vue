<script setup lang="ts">
import type { PlayerStats } from '@quiz/shared';
import { computed, onMounted, ref } from 'vue';

const props = defineProps<{ results: PlayerStats[]; highlightId?: string }>();

/** Steps are revealed one by one: third, second, then the winner. */
const shown = ref(0);
onMounted(() => {
  [400, 1200, 2200].forEach((delay, i) => setTimeout(() => (shown.value = i + 1), delay));
});

const steps = computed(() => {
  const [first, second, third] = props.results;
  return [
    { player: second, place: 2, height: 'h-32', order: 2, color: 'bg-gradient-to-b from-slate-100 to-slate-300' },
    { player: first, place: 1, height: 'h-44', order: 3, color: 'bg-gradient-to-b from-amber-300 to-brand-500 shadow-glow' },
    { player: third, place: 3, height: 'h-24', order: 1, color: 'bg-gradient-to-b from-orange-200 to-orange-400' },
  ].filter((s) => s.player);
});
const medals = ['', '🥇', '🥈', '🥉'];
</script>

<template>
  <div class="flex items-end justify-center gap-3 sm:gap-6">
    <div v-for="step in steps" :key="step.place" class="flex w-28 flex-col items-center sm:w-40">
      <Transition enter-from-class="translate-y-6 opacity-0" enter-active-class="transition duration-500 ease-out">
        <div v-if="shown >= step.order" class="mb-2 flex flex-col items-center text-center">
          <span class="text-5xl" aria-hidden="true">{{ step.player!.avatar }}</span>
          <span class="max-w-full truncate text-lg font-black" :class="step.player!.playerId === highlightId ? 'text-brand-700 dark:text-brand-300' : ''">
            {{ step.player!.nickname }}
          </span>
          <span class="font-bold tabular-nums text-slate-600 dark:text-slate-300">{{ step.player!.score }}</span>
        </div>
      </Transition>
      <div class="grid w-full place-items-center rounded-t-3xl text-4xl font-black" :class="[step.height, step.color]">
        <span aria-hidden="true">{{ medals[step.place] }}</span><span class="sr-only">{{ $t('game.podium.place', { n: step.place }) }}</span>
      </div>
    </div>
  </div>
</template>
