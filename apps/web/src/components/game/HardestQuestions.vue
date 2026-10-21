<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { correctRate, hardestQuestions, type QuestionRecord } from '@/game/report';

/** The questions the room found hardest: worth going over together after the game. */
const props = defineProps<{ questions: QuestionRecord[] }>();
const { t } = useI18n();

const hardest = computed(() => hardestQuestions(props.questions));
const percent = (q: QuestionRecord) => Math.round(correctRate(q)! * 100);
</script>

<template>
  <section v-if="hardest.length" class="mx-auto w-full max-w-4xl">
    <h3 class="text-center text-2xl font-bold text-brand-300">🧠 {{ t('game.report.hardestTitle') }}</h3>
    <p class="mt-1 text-center text-slate-400">{{ t('game.report.hardestHint') }}</p>
    <ol class="mt-5 grid gap-3">
      <li
        v-for="(q, i) in hardest"
        :key="q.number"
        class="hard-row card flex items-center gap-4 p-4"
        :style="{ animationDelay: `${i * 150}ms` }"
      >
        <span class="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-red-500/15 text-lg font-black text-red-300">
          {{ t('game.report.questionNo', { n: q.number }) }}
        </span>
        <span class="mr-auto text-lg font-bold">{{ q.prompt }}</span>
        <span class="w-28 shrink-0 text-right">
          <span class="block text-2xl font-black tabular-nums">{{ percent(q) }}%</span>
          <span class="block text-xs text-slate-400">{{ t('game.report.gotRight') }}</span>
          <span class="mt-1 block h-1.5 overflow-hidden rounded-full bg-white/10">
            <span class="block h-full rounded-full bg-gradient-to-r from-red-400 to-amber-300" :style="{ width: `${percent(q)}%` }" />
          </span>
        </span>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.hard-row {
  animation: hard-in 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
}
@keyframes hard-in {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.97);
  }
}
@media (prefers-reduced-motion: reduce) {
  .hard-row {
    animation: none;
  }
}
</style>
