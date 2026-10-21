<script setup lang="ts">
import type { QuestionPublic } from '@quiz/shared';

defineProps<{ question: QuestionPublic }>();
</script>

<template>
  <div class="flex flex-wrap items-center justify-center gap-2 text-sm font-bold">
    <span class="rounded-full bg-brand-100 px-3 py-1 text-brand-800">
      {{ question.roundName }}
      <template v-if="question.roundType !== 'normal'"> · {{ $t(`round.types.${question.roundType}`) }}</template>
    </span>
    <span class="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
      {{ $t('game.question.ofTotal', { n: question.globalIndex + 1, total: question.totalQuestions }) }}
    </span>
    <span class="rounded-full bg-amber-100 px-3 py-1 text-amber-800">{{ $t('game.question.points', { n: question.points }) }}</span>
  </div>
</template>
