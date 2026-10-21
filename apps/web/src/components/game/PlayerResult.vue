<script setup lang="ts">
import type { PlayerAnswerResult } from '@quiz/shared';

/** The player's own outcome after a question is revealed. */
defineProps<{ result: PlayerAnswerResult }>();
</script>

<template>
  <div
    class="flex animate-pop flex-col items-center gap-2 rounded-3xl p-8 text-center text-white shadow-lg"
    :class="result.correct ? 'bg-gradient-to-br from-emerald-600 to-teal-700' : result.answered ? 'bg-gradient-to-br from-rose-600 to-pink-700' : 'bg-gradient-to-br from-slate-600 to-slate-700'"
    role="status"
  >
    <span class="text-6xl" aria-hidden="true">{{ result.correct ? '✔' : result.answered ? '✕' : '⏱' }}</span>
    <p class="font-display text-3xl font-bold">
      {{ result.correct ? $t('game.reveal.correct') : result.answered ? $t('game.reveal.incorrect') : $t('game.reveal.noAnswer') }}
    </p>
    <p v-if="result.correct" class="font-display text-5xl font-bold tabular-nums">+{{ result.points }}</p>
    <p v-if="result.correct && (result.breakdown.speed > 0 || result.breakdown.streak > 0)" class="text-base font-bold">
      {{ $t('game.reveal.breakdown', { base: result.breakdown.base, speed: result.breakdown.speed, streak: result.breakdown.streak }) }}
    </p>
    <p v-if="result.streak >= 2" class="font-bold">{{ $t('game.reveal.streak', { n: result.streak }) }}</p>
    <p v-if="result.eliminated" class="rounded-full bg-white/20 px-3 py-1 font-bold">{{ $t('game.reveal.eliminated') }}</p>
    <p class="mt-2 text-lg font-bold">{{ $t('game.reveal.rank', { n: result.rank, score: result.score }) }}</p>
  </div>
</template>
