<script setup lang="ts">
import { computed } from 'vue';
import { formatNumber } from '@/game/numbers';

/**
 * The slider's range as a number line on the big screen. After the reveal it
 * shows every guess as a dot (green when close enough) and the right answer.
 */
const props = defineProps<{
  min: number;
  max: number;
  unit?: string;
  answer?: number;
  tolerance?: number;
  guesses?: number[];
}>();

const span = computed(() => props.max - props.min || 1);
const at = (n: number) => `${Math.min(100, Math.max(0, ((n - props.min) / span.value) * 100))}%`;

const dots = computed(() =>
  (props.guesses ?? []).map((value, i) => ({
    key: i,
    left: at(value),
    close: props.answer !== undefined && Math.abs(value - props.answer) <= (props.tolerance ?? 0) + 1e-9,
  })),
);

const band = computed(() => {
  if (props.answer === undefined || !props.tolerance) return undefined;
  const from = ((props.answer - props.tolerance - props.min) / span.value) * 100;
  const to = ((props.answer + props.tolerance - props.min) / span.value) * 100;
  const left = Math.max(0, from);
  return { left: `${left}%`, width: `${Math.min(100, to) - left}%` };
});
</script>

<template>
  <div class="mx-auto w-full max-w-3xl px-4">
    <div class="relative h-16">
      <div class="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 rounded-full bg-white/15 ring-1 ring-white/10" />
      <div v-if="band" class="absolute top-1/2 h-5 -translate-y-1/2 rounded-full bg-emerald-400/40" :style="band" />
      <span
        v-for="dot in dots"
        :key="dot.key"
        class="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-slate-900/40"
        :class="dot.close ? 'bg-emerald-400' : 'bg-rose-400/80'"
        :style="{ left: dot.left }"
        aria-hidden="true"
      />
      <div v-if="answer !== undefined" class="absolute top-0 flex h-full -translate-x-1/2 flex-col items-center" :style="{ left: at(answer) }">
        <span class="h-full w-1.5 rounded-full bg-emerald-300 shadow-[0_0_18px] shadow-emerald-300" />
      </div>
    </div>
    <div class="flex justify-between text-lg font-bold text-slate-400 tabular-nums">
      <span>{{ formatNumber(min) }}{{ unit ? ` ${unit}` : '' }}</span>
      <span>{{ formatNumber(max) }}{{ unit ? ` ${unit}` : '' }}</span>
    </div>
  </div>
</template>
