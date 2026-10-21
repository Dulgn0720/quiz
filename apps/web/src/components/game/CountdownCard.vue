<script setup lang="ts">
import type { PhasePayload } from '@quiz/shared';
import { watch } from 'vue';
import { sound } from '@/game/sound';
import { useCountdown } from '@/game/useCountdown';

type Countdown = Extract<PhasePayload, { phase: 'countdown' }>;

/** "Get ready" between questions; a round title card before each round's first question. */
const props = defineProps<{ countdown: Countdown }>();

const { seconds } = useCountdown(
  () => props.countdown.endsAt,
  () => props.countdown.pausedRemainingMs,
);

watch(seconds, (s, before) => {
  if (s > 0 && s < before && props.countdown.pausedRemainingMs === undefined) sound.play('countdown');
});
</script>

<template>
  <div class="flex flex-col items-center gap-4 py-10 text-center">
    <template v-if="countdown.roundStart">
      <p class="text-lg font-bold uppercase tracking-wide text-brand-700 dark:text-brand-300">
        {{ $t('game.countdown.round', { n: countdown.roundIndex + 1 }) }}
      </p>
      <h2 class="animate-pop text-4xl font-black sm:text-6xl">{{ countdown.roundName }}</h2>
      <p v-if="countdown.roundType !== 'normal'" class="max-w-md rounded-full bg-amber-100 dark:bg-amber-900/40 px-4 py-1 font-bold text-amber-900 dark:text-amber-200">
        {{ $t(`round.types.${countdown.roundType}`) }} — {{ $t(`round.typeHelp.${countdown.roundType}`) }}
      </p>
    </template>
    <p v-else class="text-2xl font-black text-slate-700 dark:text-slate-200">
      {{ $t('game.question.ofTotal', { n: countdown.globalIndex + 1, total: countdown.totalQuestions }) }}
    </p>
    <p class="text-lg font-bold text-slate-500 dark:text-slate-400">{{ $t('game.countdown.getReady') }}</p>
    <span :key="seconds" class="grid h-28 w-28 animate-pop place-items-center rounded-full bg-brand-600 text-6xl font-black text-white shadow-lg" aria-live="polite">
      {{ countdown.pausedRemainingMs !== undefined ? '❚❚' : seconds }}
    </span>
  </div>
</template>
