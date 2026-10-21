<script setup lang="ts">
import type { PlayerStats } from '@quiz/shared';

defineProps<{ results: PlayerStats[] }>();

function seconds(ms: number | null): string {
  return ms === null ? '—' : (ms / 1000).toFixed(1);
}
</script>

<template>
  <div class="card overflow-x-auto">
    <table class="w-full min-w-[32rem] text-left">
      <caption class="sr-only">{{ $t('game.podium.results') }}</caption>
      <thead class="border-b border-slate-200 text-sm text-slate-500">
        <tr>
          <th scope="col" class="px-4 py-3">#</th>
          <th scope="col" class="px-4 py-3">{{ $t('game.podium.player') }}</th>
          <th scope="col" class="px-4 py-3 text-right">{{ $t('game.podium.score') }}</th>
          <th scope="col" class="px-4 py-3 text-right">{{ $t('game.podium.correct') }}</th>
          <th scope="col" class="px-4 py-3 text-right">{{ $t('game.podium.bestStreak') }}</th>
          <th scope="col" class="px-4 py-3 text-right">{{ $t('game.podium.avgTime') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in results" :key="r.playerId" class="border-b border-slate-100 last:border-0">
          <td class="px-4 py-3 font-black tabular-nums">{{ r.rank }}</td>
          <td class="px-4 py-3 font-bold"><span aria-hidden="true">{{ r.avatar }}</span> {{ r.nickname }}</td>
          <td class="px-4 py-3 text-right font-black tabular-nums">{{ r.score }}</td>
          <td class="px-4 py-3 text-right tabular-nums">{{ r.correctCount }}/{{ r.questionCount }}</td>
          <td class="px-4 py-3 text-right tabular-nums">{{ r.bestStreak }}</td>
          <td class="px-4 py-3 text-right tabular-nums">{{ seconds(r.avgResponseMs) }} {{ $t('common.seconds') }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
