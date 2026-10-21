<script setup lang="ts">
import type { QuestionPublic, RevealedAnswer } from '@quiz/shared';
import { computed } from 'vue';
import { tileStyle } from '@/game/answers';

/**
 * The correct answer spelled out. Players always see it (that's the lesson);
 * the host screen already highlights correct tiles, so it passes `choices=false`.
 */
const props = withDefaults(
  defineProps<{ question: QuestionPublic; answer: RevealedAnswer; size?: 'md' | 'lg'; choices?: boolean }>(),
  { size: 'md', choices: true },
);

const lg = computed(() => props.size === 'lg');

const orderedItems = computed(() => {
  if (props.question.type !== 'ordering' || props.answer.type !== 'ordering') return [];
  const byId = new Map(props.question.items.map((item) => [item.id, item]));
  return props.answer.itemIds.map((id) => byId.get(id)!).filter(Boolean);
});

/** Correct options with their on-screen position, so the tile colour and shape match what the player saw. */
const correctOptions = computed(() => {
  if (!('options' in props.question) || !('optionIds' in props.answer)) return [];
  const ids = props.answer.optionIds;
  return props.question.options.map((option, index) => ({ option, index })).filter(({ option }) => ids.includes(option.id));
});
</script>

<template>
  <div v-if="answer.type === 'type_answer'" class="text-center">
    <p class="font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400" :class="lg ? 'text-base' : 'text-sm'">
      {{ $t('game.reveal.acceptedAnswers') }}
    </p>
    <p
      class="mt-1 font-display font-bold text-emerald-700 dark:text-emerald-300"
      :class="lg ? 'text-6xl sm:text-7xl' : 'text-3xl'"
    >
      {{ answer.acceptedAnswers.join(' · ') }}
    </p>
  </div>

  <div v-else-if="answer.type === 'ordering'" class="mx-auto w-full" :class="lg ? 'max-w-2xl' : 'max-w-md'">
    <p class="text-center font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400" :class="lg ? 'text-base' : 'text-sm'">
      {{ $t('game.reveal.correctOrder') }}
    </p>
    <ol class="mt-2 flex flex-col gap-2">
      <li
        v-for="(item, i) in orderedItems"
        :key="item.id"
        class="flex items-center gap-3 rounded-2xl bg-emerald-50 font-bold text-emerald-900 ring-1 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-100 dark:ring-emerald-500/30"
        :class="lg ? 'px-6 py-3 text-2xl' : 'px-4 py-2'"
      >
        <span class="font-display tabular-nums">{{ i + 1 }}.</span> {{ item.text }}
      </li>
    </ol>
  </div>

  <div v-else-if="choices && correctOptions.length" class="text-center">
    <p class="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
      {{ $t(correctOptions.length > 1 ? 'game.reveal.correctAnswers' : 'game.reveal.correctAnswer') }}
    </p>
    <ul class="mt-2 flex flex-col gap-2">
      <li
        v-for="{ option, index } in correctOptions"
        :key="option.id"
        class="flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-lg font-extrabold shadow-lg"
        :class="[tileStyle(index).bg, tileStyle(index).fg]"
      >
        <span aria-hidden="true">{{ tileStyle(index).shape }}</span>
        <img v-if="option.imageUrl" :src="option.imageUrl" alt="" class="h-10 w-10 rounded-lg bg-white object-contain" />
        <span>{{ option.text }}</span>
      </li>
    </ul>
  </div>

  <div v-else-if="choices && answer.type === 'true_false'" class="text-center">
    <p class="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ $t('game.reveal.correctAnswer') }}</p>
    <p
      class="mx-auto mt-2 w-fit rounded-2xl px-6 py-3 text-2xl font-extrabold text-white shadow-lg"
      :class="answer.value ? 'bg-gradient-to-br from-sky-600 to-blue-700' : 'bg-gradient-to-br from-rose-600 to-pink-700'"
    >
      <span aria-hidden="true">{{ answer.value ? '✓' : '✕' }}</span> {{ answer.value ? $t('question.true') : $t('question.false') }}
    </p>
  </div>
</template>
