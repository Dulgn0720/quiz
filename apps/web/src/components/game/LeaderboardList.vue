<script setup lang="ts">
import type { LeaderboardEntry } from '@quiz/shared';
import { computed, onBeforeUnmount, ref, watch } from 'vue';

const props = withDefaults(defineProps<{ entries: LeaderboardEntry[]; highlightId?: string; size?: 'md' | 'lg' }>(), {
  size: 'md',
});

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

/** No arrows until there is a real previous ranking (after the first question everyone was tied). */
const hasHistory = computed(() => new Set(props.entries.map((e) => e.previousRank)).size > 1);

function movement(entry: LeaderboardEntry): 'up' | 'down' | null {
  if (!hasHistory.value || entry.previousRank <= 0) return null;
  if (entry.rank < entry.previousRank) return 'up';
  if (entry.rank > entry.previousRank) return 'down';
  return null;
}
</script>

<template>
  <TransitionGroup tag="ol" class="relative flex flex-col" :class="size === 'lg' ? 'gap-3' : 'gap-2'" move-class="transition-transform duration-700 ease-out">
    <li
      v-for="entry in rows"
      :key="entry.playerId"
      class="flex items-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-white/[0.06] dark:ring-white/10"
      :class="[
        size === 'lg' ? 'gap-5 px-6 py-4' : 'gap-3 px-4 py-3',
        entry.playerId === highlightId ? 'ring-2 ring-brand-500 dark:ring-brand-400' : '',
        entry.rank === 1 ? 'dark:bg-brand-500/15' : '',
      ]"
    >
      <span
        class="text-center font-display font-bold tabular-nums text-slate-500 dark:text-slate-300"
        :class="size === 'lg' ? 'w-12 text-3xl' : 'w-8 text-xl'"
      >
        {{ entry.rank }}
      </span>
      <span class="leading-none" :class="size === 'lg' ? 'text-5xl' : 'text-3xl'" aria-hidden="true">{{ entry.avatar }}</span>
      <span class="mr-auto truncate font-extrabold" :class="size === 'lg' ? 'text-3xl' : 'text-lg'">
        {{ entry.nickname }}
        <span
          v-if="entry.streak >= 2"
          class="ml-1 text-orange-500 dark:text-orange-300"
          :class="size === 'lg' ? 'text-xl' : 'text-sm'"
          :title="$t('game.reveal.streak', { n: entry.streak })"
        >
          🔥{{ entry.streak }}
        </span>
      </span>
      <span v-if="movement(entry) === 'up'" class="font-black text-emerald-500" :class="size === 'lg' ? 'text-2xl' : 'text-sm'">
        <span aria-hidden="true">▲</span><span class="sr-only">{{ $t('game.leaderboard.movedUp') }}</span>
      </span>
      <span v-else-if="movement(entry) === 'down'" class="font-black text-rose-500" :class="size === 'lg' ? 'text-2xl' : 'text-sm'">
        <span aria-hidden="true">▼</span><span class="sr-only">{{ $t('game.leaderboard.movedDown') }}</span>
      </span>
      <span v-if="entry.delta > 0" class="font-bold tabular-nums text-slate-500 dark:text-slate-300" :class="size === 'lg' ? 'text-xl' : 'text-sm'">
        +{{ entry.delta }}
      </span>
      <span class="text-right font-display font-bold tabular-nums" :class="size === 'lg' ? 'w-32 text-4xl' : 'w-20 text-xl'">{{ entry.score }}</span>
    </li>
  </TransitionGroup>
</template>
