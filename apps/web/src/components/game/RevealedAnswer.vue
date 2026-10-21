<script setup lang="ts">
import type { QuestionPublic, RevealedAnswer } from '@quiz/shared';
import { computed } from 'vue';

/** The correct answer spelled out, for question types a chart cannot show. */
const props = defineProps<{ question: QuestionPublic; answer: RevealedAnswer }>();

const orderedItems = computed(() => {
  if (props.question.type !== 'ordering' || props.answer.type !== 'ordering') return [];
  const byId = new Map(props.question.items.map((item) => [item.id, item]));
  return props.answer.itemIds.map((id) => byId.get(id)!).filter(Boolean);
});
</script>

<template>
  <div v-if="answer.type === 'type_answer'" class="text-center">
    <p class="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ $t('game.reveal.acceptedAnswers') }}</p>
    <p class="mt-1 text-2xl font-black text-emerald-700 dark:text-emerald-300">{{ answer.acceptedAnswers.join(' · ') }}</p>
  </div>
  <div v-else-if="answer.type === 'ordering'" class="mx-auto max-w-md">
    <p class="text-center text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ $t('game.reveal.correctOrder') }}</p>
    <ol class="mt-2 flex flex-col gap-2">
      <li v-for="(item, i) in orderedItems" :key="item.id" class="flex items-center gap-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 px-4 py-2 font-bold text-emerald-900 dark:text-emerald-200 ring-1 ring-emerald-200">
        <span class="font-black tabular-nums">{{ i + 1 }}.</span> {{ item.text }}
      </li>
    </ol>
  </div>
</template>
