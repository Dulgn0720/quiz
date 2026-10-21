<script setup lang="ts">
import type { QuestionPublic, QuestionReveal } from '@quiz/shared';
import { computed } from 'vue';
import { tileStyle } from '@/game/answers';
import GameTimer from './GameTimer.vue';
import QuestionHeader from './QuestionHeader.vue';

/** The question on the shared (projector) screen. With `reveal`, correct answers are highlighted. */
const props = defineProps<{
  question: QuestionPublic;
  reveal?: QuestionReveal;
  answered?: number;
  total?: number;
}>();

const correctIds = computed(() =>
  props.reveal && 'optionIds' in props.reveal.answer ? new Set(props.reveal.answer.optionIds) : new Set<string>(),
);
const trueFalseAnswer = computed(() =>
  props.reveal?.answer.type === 'true_false' ? props.reveal.answer.value : undefined,
);
</script>

<template>
  <div class="flex flex-col gap-6">
    <QuestionHeader :question="question" />
    <div class="flex items-start gap-4">
      <h2 class="flex-1 text-center text-3xl font-black leading-tight sm:text-5xl">{{ question.prompt }}</h2>
    </div>

    <div class="flex items-center justify-center gap-6">
      <GameTimer
        v-if="!reveal"
        :ends-at="question.endsAt"
        :paused-remaining-ms="question.pausedRemainingMs"
        :total="question.timeLimit"
        size="lg"
      />
      <img
        v-if="question.imageUrl"
        :src="question.imageUrl"
        alt=""
        class="max-h-[38vh] max-w-full rounded-2xl object-contain shadow"
      />
      <div v-if="!reveal && total !== undefined" class="text-center" aria-live="polite">
        <p class="text-5xl font-black tabular-nums">{{ answered }}</p>
        <p class="text-sm font-bold text-slate-500">{{ $t('game.question.answers', { total }) }}</p>
      </div>
    </div>

    <ul v-if="'options' in question" class="grid gap-3 sm:grid-cols-2">
      <li
        v-for="(option, i) in question.options"
        :key="option.id"
        class="flex min-h-20 items-center gap-4 rounded-2xl px-5 py-4 text-xl font-black text-white shadow transition sm:text-2xl"
        :class="[tileStyle(i).bg, reveal && !correctIds.has(option.id) ? 'opacity-30' : '']"
      >
        <span class="text-3xl" aria-hidden="true">{{ tileStyle(i).shape }}</span>
        <img v-if="option.imageUrl" :src="option.imageUrl" alt="" class="h-16 w-16 rounded-lg bg-white object-contain" />
        <span class="flex-1">{{ option.text }}</span>
        <span v-if="reveal && correctIds.has(option.id)" class="text-3xl" :aria-label="$t('game.reveal.correct')">✔</span>
        <span v-if="reveal" class="text-lg tabular-nums opacity-90">{{ reveal.distribution[option.id] ?? 0 }}</span>
      </li>
    </ul>

    <ul v-else-if="question.type === 'true_false'" class="grid grid-cols-2 gap-3">
      <li
        v-for="value in [true, false]"
        :key="String(value)"
        class="flex min-h-24 items-center justify-center gap-3 rounded-2xl text-3xl font-black text-white shadow"
        :class="[value ? 'bg-sky-500' : 'bg-rose-500', trueFalseAnswer !== undefined && trueFalseAnswer !== value ? 'opacity-30' : '']"
      >
        <span aria-hidden="true">{{ value ? '✓' : '✕' }}</span>
        {{ value ? $t('question.true') : $t('question.false') }}
      </li>
    </ul>

    <ol v-else-if="question.type === 'ordering' && !reveal" class="mx-auto flex w-full max-w-xl flex-col gap-2">
      <li v-for="item in question.items" :key="item.id" class="rounded-xl bg-white px-5 py-3 text-xl font-bold shadow-sm ring-1 ring-slate-200">
        {{ item.text }}
      </li>
    </ol>

    <p v-else-if="question.type === 'type_answer' && !reveal" class="text-center text-xl font-bold text-slate-500">
      ⌨️ {{ $t('game.question.typeOnDevice') }}
    </p>
  </div>
</template>
