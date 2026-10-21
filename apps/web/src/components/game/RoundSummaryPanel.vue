<script setup lang="ts">
import type { LeaderboardEntry, RoundStats } from '@quiz/shared';
import LeaderboardList from './LeaderboardList.vue';

defineProps<{ round: RoundStats; leaderboard: LeaderboardEntry[]; highlightId?: string }>();
</script>

<template>
  <div class="mx-auto w-full max-w-2xl">
    <p class="text-center text-sm font-bold uppercase tracking-wide text-brand-700">{{ $t(`round.types.${round.roundType}`) }}</p>
    <h2 class="text-center text-3xl font-black sm:text-4xl">{{ $t('game.roundSummary.title', { name: round.roundName }) }}</h2>
    <dl class="mt-6 grid grid-cols-2 gap-3">
      <div class="card p-4 text-center">
        <dt class="text-sm font-bold text-slate-500">{{ $t('game.roundSummary.correctRate') }}</dt>
        <dd class="text-3xl font-black">{{ Math.round(round.correctRate * 100) }}%</dd>
      </div>
      <div class="card p-4 text-center">
        <dt class="text-sm font-bold text-slate-500">{{ $t('game.roundSummary.topScorer') }}</dt>
        <dd v-if="round.topScorer" class="truncate text-2xl font-black">
          {{ round.topScorer.avatar }} {{ round.topScorer.nickname }}
          <span class="block text-sm font-bold text-emerald-600">+{{ round.topScorer.points }}</span>
        </dd>
        <dd v-else class="text-2xl font-black text-slate-400">—</dd>
      </div>
    </dl>
    <LeaderboardList class="mt-6" :entries="leaderboard" :highlight-id="highlightId" />
  </div>
</template>
