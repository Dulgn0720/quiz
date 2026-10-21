<script setup lang="ts">
import { computed, watch } from 'vue';
import { sound } from '@/game/sound';
import { useCountdown } from '@/game/useCountdown';

const props = defineProps<{
  endsAt: number;
  pausedRemainingMs?: number;
  /** Full length of the timer, in seconds. */
  total: number;
  size?: 'md' | 'lg';
}>();

const { remainingMs, seconds } = useCountdown(
  () => props.endsAt,
  () => props.pausedRemainingMs,
);

const RADIUS = 44;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const fraction = computed(() => Math.min(1, remainingMs.value / (props.total * 1000)));
const urgent = computed(() => seconds.value <= 5 && props.pausedRemainingMs === undefined);

// Ticking for the last seconds; only the big host screen buzzes when time runs out.
watch(seconds, (s, before) => {
  if (props.pausedRemainingMs !== undefined || s >= before) return;
  if (s > 0 && s <= 5) sound.play('tick');
  else if (s === 0 && props.size === 'lg') sound.play('timeUp');
});
</script>

<template>
  <div
    class="relative grid place-items-center"
    :class="size === 'lg' ? 'h-28 w-28 text-4xl' : 'h-16 w-16 text-2xl'"
    role="timer"
    :aria-label="$t('game.question.secondsLeft', { n: seconds })"
  >
    <svg viewBox="0 0 100 100" class="absolute inset-0 -rotate-90" aria-hidden="true">
      <circle cx="50" cy="50" :r="RADIUS" class="fill-white dark:fill-slate-900 stroke-slate-200 dark:stroke-slate-700" stroke-width="8" />
      <circle
        cx="50"
        cy="50"
        :r="RADIUS"
        fill="none"
        stroke-width="8"
        stroke-linecap="round"
        :class="urgent ? 'stroke-rose-500' : 'stroke-brand-600'"
        :stroke-dasharray="CIRCUMFERENCE"
        :stroke-dashoffset="CIRCUMFERENCE * (1 - fraction)"
      />
    </svg>
    <span class="relative font-black tabular-nums" :class="urgent ? 'text-rose-600' : 'text-slate-800 dark:text-slate-100'">
      {{ pausedRemainingMs !== undefined ? '❚❚' : seconds }}
    </span>
  </div>
</template>
