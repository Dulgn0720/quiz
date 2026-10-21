<script setup lang="ts">
import type { LeaderboardEntry } from '@quiz/shared';
import { onBeforeUnmount, ref, watch } from 'vue';

const props = defineProps<{ entries: LeaderboardEntry[]; highlightId?: string }>();

/**
 * Rows first render in their previous order, then move to the new one so
 * TransitionGroup animates overtakes.
 */
const rows = ref<LeaderboardEntry[]>([]);
let timer: ReturnType<typeof setTimeout> | undefined;

watch(
  () => props.entries,
  (entries) => {
    clearTimeout(timer);
    rows.value = [...entries].sort((a, b) => a.previousRank - b.previousRank || a.rank - b.rank);
    timer = setTimeout(() => (rows.value = entries), 600);
  },
  { immediate: true },
);
onBeforeUnmount(() => clearTimeout(timer));

function movement(entry: LeaderboardEntry): 'up' | 'down' | null {
  if (entry.rank < entry.previousRank) return 'up';
  if (entry.rank > entry.previousRank) return 'down';
  return null;
}
</script>

<template>
  <TransitionGroup tag="ol" class="relative flex flex-col gap-2" move-class="transition-transform duration-700 ease-out">
    <li
      v-for="entry in rows"
      :key="entry.playerId"
      class="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200"
      :class="entry.playerId === highlightId ? 'ring-2 ring-brand-500' : ''"
    >
      <span class="w-8 text-center text-xl font-black tabular-nums text-slate-500">{{ entry.rank }}</span>
      <span class="text-3xl leading-none" aria-hidden="true">{{ entry.avatar }}</span>
      <span class="mr-auto truncate text-lg font-black">
        {{ entry.nickname }}
        <span v-if="entry.streak >= 2" class="ml-1 text-sm text-orange-500" :title="$t('game.reveal.streak', { n: entry.streak })">
          🔥{{ entry.streak }}
        </span>
      </span>
      <span v-if="movement(entry) === 'up'" class="text-sm font-black text-emerald-600" :aria-label="$t('game.leaderboard.movedUp')">▲</span>
      <span v-else-if="movement(entry) === 'down'" class="text-sm font-black text-rose-500" :aria-label="$t('game.leaderboard.movedDown')">▼</span>
      <span v-if="entry.delta > 0" class="text-sm font-bold text-emerald-600">+{{ entry.delta }}</span>
      <span class="w-20 text-right text-xl font-black tabular-nums">{{ entry.score }}</span>
    </li>
  </TransitionGroup>
</template>
