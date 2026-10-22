<script setup lang="ts">
import type { QuestionPublic, QuestionReveal } from '@quiz/shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { tileStyle } from '@/game/answers';

const props = defineProps<{ question: QuestionPublic; reveal: QuestionReveal }>();
const { t } = useI18n();

interface Bar {
  key: string;
  label: string;
  count: number;
  correct: boolean;
  color: string;
  shape?: string;
}

/** Answer distribution as bars, correct ones highlighted. */
const bars = computed<Bar[]>(() => {
  const { question, reveal } = props;
  const d = reveal.distribution;
  if ('options' in question && 'optionIds' in reveal.answer) {
    const correct = new Set(reveal.answer.optionIds);
    return question.options.map((option, i) => ({
      key: option.id,
      label: option.text || t('game.question.imageOption', { n: i + 1 }),
      count: d[option.id] ?? 0,
      correct: correct.has(option.id),
      color: tileStyle(i).bg,
      shape: tileStyle(i).shape,
    }));
  }
  if (reveal.answer.type === 'true_false') {
    const value = reveal.answer.value;
    return [
      { key: 'true', label: t('question.true'), count: d.true ?? 0, correct: value, color: 'bg-sky-600', shape: '✓' },
      { key: 'false', label: t('question.false'), count: d.false ?? 0, correct: !value, color: 'bg-rose-600', shape: '✕' },
    ];
  }
  return [
    { key: 'correct', label: t('game.reveal.correct'), count: d.correct ?? 0, correct: true, color: 'bg-emerald-600' },
    { key: 'incorrect', label: t('game.reveal.incorrect'), count: d.incorrect ?? 0, correct: false, color: 'bg-rose-600' },
  ];
});

const max = computed(() => Math.max(1, ...bars.value.map((b) => b.count)));
</script>

<template>
  <div class="flex h-56 items-end justify-center gap-3 sm:gap-6" role="img" :aria-label="t('game.reveal.distribution')">
    <div v-for="bar in bars" :key="bar.key" class="flex h-full w-16 flex-col items-center justify-end sm:w-24">
      <span class="mb-1 text-xl font-black tabular-nums">{{ bar.count }}</span>
      <div
        class="w-full origin-bottom animate-grow rounded-t-xl transition-all"
        :class="[bar.color, bar.correct ? '' : 'opacity-40']"
        :style="{ height: `${Math.max(4, (bar.count / max) * 100)}%` }"
      />
      <span class="mt-2 flex items-center gap-1 text-center text-sm font-bold leading-tight">
        <span v-if="bar.shape" aria-hidden="true">{{ bar.shape }}</span>
        <span class="line-clamp-2">{{ bar.label }}</span>
        <span v-if="bar.correct" class="text-emerald-500"><span aria-hidden="true">✔</span><span class="sr-only">{{ t('game.reveal.correct') }}</span></span>
      </span>
    </div>
  </div>
</template>
